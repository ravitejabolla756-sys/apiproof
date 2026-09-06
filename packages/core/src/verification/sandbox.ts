import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { VerificationLimits, VerificationStage } from '@apiproof/shared';
import { VerificationLimitsSchema } from '@apiproof/shared';

export interface SandboxExecutionRequest { stage: VerificationStage['stage']; cwd: string; argv: readonly string[]; env: Readonly<Record<string,string>>; limits: VerificationLimits }
export interface ExecutionSandbox { run(request: SandboxExecutionRequest): Promise<VerificationStage> }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function result(stage: VerificationStage['stage'], status: VerificationStage['status'], stdout='', stderr='', exitCode: number|null=null, durationMs=0, limits?: VerificationLimits): VerificationStage { const max=limits?.maxOutputBytes ?? 65536; const out=stdout.slice(0,max), err=stderr.slice(0,max); return {stage,status,exitCode,durationMs,stdout:out,stderr:err,stdoutDigest:digest(out),stderrDigest:digest(err),stdoutTruncated:stdout.length>max,stderrTruncated:stderr.length>max}; }
export class FakeSandbox implements ExecutionSandbox {
  constructor(private readonly behavior: Partial<Record<VerificationStage['stage'], { status?: VerificationStage['status']; stdout?: string; stderr?: string; exitCode?: number }>> = {}) {}
  async run(request: SandboxExecutionRequest): Promise<VerificationStage> { const spec=this.behavior[request.stage] ?? {}; return result(request.stage, spec.status ?? 'PASSED', spec.stdout ?? '', spec.stderr ?? '', spec.exitCode ?? 0, 1, request.limits); }
}
export class DockerSandbox implements ExecutionSandbox {
  constructor(private readonly dockerPath='docker') {}
  async run(request: SandboxExecutionRequest): Promise<VerificationStage> {
    const limits=VerificationLimitsSchema.parse(request.limits); const started=Date.now();
    // The command, env and mounts are APIProof-owned. Docker mode is opt-in and fails closed when unavailable.
    const args=['run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','64','--memory',`${limits.memoryMb}m`,'--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--mount',`type=bind,src=${request.cwd},dst=/workspace,rw`,'--workdir','/workspace','node:22-alpine',...request.argv];
    return await new Promise((resolve) => { const child=spawn(this.dockerPath,args,{cwd:request.cwd,env:{PATH:request.env.PATH ?? '',CI:'true',NODE_ENV:'test'},shell:false,windowsHide:true}); let stdout='',stderr=''; let timed=false; const timer=setTimeout(()=>{timed=true;child.kill('SIGKILL');},limits.timeoutMs); child.stdout.on('data',(c:Buffer)=>{stdout+=c.toString();}); child.stderr.on('data',(c:Buffer)=>{stderr+=c.toString();}); child.on('error',()=>{clearTimeout(timer);resolve(result(request.stage,'FAILED','', 'Docker unavailable.',null,Date.now()-started,limits));}); child.on('close',(code)=>{clearTimeout(timer);resolve(result(request.stage,timed?'TIMED_OUT':code===0?'PASSED':'FAILED',stdout,stderr,code,Date.now()-started,limits));}); });
  }
}
