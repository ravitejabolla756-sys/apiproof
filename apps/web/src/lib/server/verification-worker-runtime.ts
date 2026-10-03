import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertLiveWriteConfig, buildDockerProcessEnvironment, loadGitHubAppConfig, VERIFICATION_DOCKER_IMAGE } from '@apiproof/core';

const execFileAsync = promisify(execFile);

async function dockerCheck(args: string[]): Promise<string> {
  const dockerPath = process.env.DOCKER_PATH?.trim() || 'docker';
  const { stdout } = await execFileAsync(dockerPath, args, {
    cwd: process.cwd(),
    env: { ...buildDockerProcessEnvironment(), NODE_ENV: 'production' },
    timeout: 10_000,
    maxBuffer: 4096,
    windowsHide: true,
  });
  return stdout;
}

export async function probeDockerVerificationRuntime(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') throw new Error('VERIFICATION_WORKER_REQUIRES_PRODUCTION_MODE');
  if (process.env.APIPROOF_ENABLE_LIVE_GITHUB !== 'true' || process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE !== 'true') {
    throw new Error('VERIFICATION_WORKER_GITHUB_WRITE_NOT_CONFIGURED');
  }
  if (!process.env.APIPROOF_SECRET?.trim() && !process.env.AUTH_SECRET?.trim()) {
    throw new Error('VERIFICATION_WORKER_EVIDENCE_SECRET_NOT_CONFIGURED');
  }
  assertLiveWriteConfig(loadGitHubAppConfig(), true);
  let engine: string;
  try {
    engine = await dockerCheck(['info', '--format', '{{.OSType}}']);
  } catch {
    throw new Error('VERIFICATION_DOCKER_LINUX_ENGINE_UNAVAILABLE');
  }
  if (engine.trim() !== 'linux') throw new Error('VERIFICATION_DOCKER_LINUX_ENGINE_UNAVAILABLE');
  try {
    await dockerCheck(['image', 'inspect', VERIFICATION_DOCKER_IMAGE]);
  } catch {
    throw new Error('VERIFICATION_PINNED_IMAGE_UNAVAILABLE');
  }
}
