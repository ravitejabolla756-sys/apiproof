import { createHash, randomUUID } from 'node:crypto';
import type { VerificationLimits, VerificationStage } from '@apiproof/shared';
import { VerificationLimitsSchema } from '@apiproof/shared';
import type { DependencyProvisioning } from './provisioning.js';
import { resolveDockerPath, runDockerProcess, type DockerProcessResult } from './docker-process.js';
import { ARTIFACT_DIGEST_SCRIPT } from './artifact-integrity.js';

export interface SandboxExecutionRequest { stage: VerificationStage['stage']; cwd: string; argv: readonly string[]; env: Readonly<Record<string,string>>; limits: VerificationLimits; dependencyProvisioning?: DependencyProvisioning }
export interface ExecutionSandbox { run(request: SandboxExecutionRequest): Promise<VerificationStage> }
export const VERIFICATION_DOCKER_IMAGE = 'node:22.14.0-alpine3.21';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function result(stage: VerificationStage['stage'], status: VerificationStage['status'], stdout='', stderr='', exitCode: number|null=null, durationMs=0, limits?: VerificationLimits): VerificationStage { const max=limits?.maxOutputBytes ?? 65536; const out=stdout.slice(0,max), err=stderr.slice(0,max); return {stage,status,exitCode,durationMs,stdout:out,stderr:err,stdoutDigest:digest(out),stderrDigest:digest(err),stdoutTruncated:stdout.length>max,stderrTruncated:stderr.length>max}; }
export class FakeSandbox implements ExecutionSandbox {
  constructor(private readonly behavior: Partial<Record<VerificationStage['stage'], { status?: VerificationStage['status']; stdout?: string; stderr?: string; exitCode?: number }>> = {}) {}
  async run(request: SandboxExecutionRequest): Promise<VerificationStage> { const spec=this.behavior[request.stage] ?? {}; return result(request.stage, spec.status ?? 'PASSED', spec.stdout ?? '', spec.stderr ?? '', spec.exitCode ?? 0, 1, request.limits); }
}
export function buildDockerRunArgs(request: SandboxExecutionRequest, limits: VerificationLimits): string[] {
  const args = ['run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','64','--memory',`${limits.memoryMb}m`,'--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--tmpfs','/root/.cache:rw,nosuid,size=64m','--tmpfs','/workspace/.verification-cache:rw,nosuid,size=64m','--env','COREPACK_ENABLE_NETWORK=0','--env','COREPACK_HOME=/provisioned-dependencies/corepack','--env','HOME=/tmp','--env','npm_config_cache=/provisioned-dependencies/npm-cache','--env','YARN_ENABLE_GLOBAL_CACHE=false','--env','YARN_CACHE_FOLDER=/provisioned-dependencies/yarn-cache','--env','PNPM_HOME=/tmp/pnpm-home','--mount',`type=bind,src=${request.cwd},dst=/workspace,readonly=true`];
  // Dependencies remain in the isolated container across stages, never in a writable host mount.
  args.push('--tmpfs','/workspace/node_modules:rw,exec,nosuid,size=512m','--env','CI=true','--env','NODE_ENV=test');
  if (request.dependencyProvisioning) args.push('--mount', `type=bind,src=${request.dependencyProvisioning.root},dst=/provisioned-dependencies,readonly=true`);
  // pnpm's project registry is execution bookkeeping, not package content.
  if (request.dependencyProvisioning?.packageManager === 'pnpm') args.push('--tmpfs', '/provisioned-dependencies/pnpm-store/v10/projects:rw,noexec,nosuid,size=4m');
  args.push('--workdir','/workspace',VERIFICATION_DOCKER_IMAGE,...request.argv);
  return args;
}
export class DockerSandbox implements ExecutionSandbox {
  constructor(private readonly dockerPath=resolveDockerPath()) {}
  async run(request: SandboxExecutionRequest): Promise<VerificationStage> {
    const limits = VerificationLimitsSchema.parse(request.limits);
    const name = `apiproof-verification-${randomUUID()}`;
    const args = buildDockerRunArgs(request, limits);
    args.splice(1, 0, '--name', name);
    try { return stageResult(request, await this.execute(args, request)); }
    finally { await this.removeContainer(name, request); }
  }

  async runSequence(requests: readonly SandboxExecutionRequest[]): Promise<VerificationStage[]> {
    if (!requests.length) return [];
    const first = requests[0]!;
    if (requests.some((request) => request.cwd !== first.cwd || request.dependencyProvisioning?.root !== first.dependencyProvisioning?.root)) {
      return [result(first.stage, 'FAILED', '', 'Verification stages must share one captured workspace and provisioning.')];
    }
    const limits = VerificationLimitsSchema.parse(first.limits);
    const name = `apiproof-verification-${randomUUID()}`;
    const lifetime = Math.ceil(requests.reduce((sum, request) => sum + request.limits.timeoutMs, 60000) / 1000);
    const args = buildDockerRunArgs({ ...first, argv: ['sleep', String(lifetime)] }, limits);
    args.splice(1, 0, '--detach', '--name', name);
    const steps: VerificationStage[] = [];
    try {
      const startup = await this.execute(args, first);
      if (startup.code !== 0 || startup.timedOut) return [stageResult(first, startup)];
      if (first.dependencyProvisioning) {
        const integrity = await this.execute(['exec', name, 'node', '-e', ARTIFACT_DIGEST_SCRIPT, '/provisioned-dependencies', first.dependencyProvisioning.artifactDigest], first);
        if (integrity.code !== 0 || integrity.timedOut) return [stageResult(first, integrity)];
      }
      // Docker process exit codes are authoritative. Repository stdout is never a control channel.
      for (const request of requests) {
        const step = stageResult(request, await this.execute(['exec', '--workdir', '/workspace', name, ...request.argv], request));
        steps.push(step);
        if (step.status !== 'PASSED') break;
      }
      return steps;
    } finally { await this.removeContainer(name, first); }
  }
  private async execute(args: readonly string[], request: SandboxExecutionRequest): Promise<DockerProcessResult> {
    const limits = VerificationLimitsSchema.parse(request.limits);
    return await runDockerProcess(this.dockerPath, args, { cwd: request.cwd, path: request.env.PATH, timeoutMs: limits.timeoutMs, maxOutputBytes: limits.maxOutputBytes });
  }
  private async removeContainer(name: string, request: SandboxExecutionRequest): Promise<void> {
    await runDockerProcess(this.dockerPath, ['rm', '--force', name], { cwd: request.cwd, path: request.env.PATH, timeoutMs: 10000, maxOutputBytes: 4096 });
  }
}

function stageResult(request: SandboxExecutionRequest, execution: DockerProcessResult): VerificationStage {
  return { ...result(request.stage, execution.timedOut ? 'TIMED_OUT' : execution.code === 0 ? 'PASSED' : 'FAILED', execution.stdout, execution.stderr, execution.code, execution.durationMs, request.limits), stdoutTruncated: execution.stdoutTruncated, stderrTruncated: execution.stderrTruncated };
}
