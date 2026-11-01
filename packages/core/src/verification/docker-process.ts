import { spawn } from 'node:child_process';

/** Trusted worker configuration; never taken from repository contents. */
export function resolveDockerPath(source: NodeJS.ProcessEnv = process.env): string {
  return source.DOCKER_PATH?.trim() || 'docker';
}

const DOCKER_ENV_KEYS = [
  'PATH',
  'DOCKER_CONTEXT',
  'DOCKER_HOST',
  'DOCKER_CONFIG',
  'DOCKER_CERT_PATH',
  'DOCKER_TLS_VERIFY',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
] as const;

/** Keep Docker CLI context/config available without forwarding application secrets. */
export function buildDockerProcessEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    CI: 'true',
    NODE_ENV: source.NODE_ENV ?? 'test',
  };
  for (const key of DOCKER_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

/** Select the configured Docker context explicitly for every CLI invocation. */
export function buildDockerProcessArgs(
  args: readonly string[],
  source: NodeJS.ProcessEnv = process.env,
): string[] {
  const context = source.DOCKER_CONTEXT?.trim();
  return context ? ['--context', context, ...args] : [...args];
}

export interface DockerProcessResult {
  code: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
}

/** Executes only the trusted Docker CLI, never repository code on the host. */
export async function runDockerProcess(dockerPath: string, args: readonly string[], options: {
  cwd: string; path?: string | undefined; timeoutMs: number; maxOutputBytes: number;
}): Promise<DockerProcessResult> {
  const started = Date.now();
  return await new Promise((resolve) => {
    const environment = buildDockerProcessEnvironment({ ...process.env, PATH: options.path ?? process.env.PATH ?? '' });
    const child = spawn(dockerPath, buildDockerProcessArgs(args, environment), {
      cwd: options.cwd,
      env: environment,
      shell: false, windowsHide: true,
    });
    let stdout = Buffer.alloc(0); let stderr = Buffer.alloc(0);
    let stdoutTruncated = false; let stderrTruncated = false; let timedOut = false; let settled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, options.timeoutMs);
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ code, timedOut, stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), stdoutTruncated, stderrTruncated, durationMs: Date.now() - started });
    };
    child.stdout.on('data', (chunk: Buffer) => {
      const remaining = Math.max(0, options.maxOutputBytes - stdout.length);
      stdoutTruncated ||= chunk.length > remaining;
      stdout = Buffer.concat([stdout, chunk.subarray(0, remaining)]);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const remaining = Math.max(0, options.maxOutputBytes - stderr.length);
      stderrTruncated ||= chunk.length > remaining;
      stderr = Buffer.concat([stderr, chunk.subarray(0, remaining)]);
    });
    child.on('error', () => { stderr = Buffer.from('Docker CLI unavailable.'); finish(null); });
    child.on('close', finish);
  });
}
