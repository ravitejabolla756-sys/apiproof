import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ChildProcess from 'node:child_process';
import type * as Core from '@apiproof/core';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof ChildProcess>(),
  execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: execute }),
}));
vi.mock('@apiproof/core', async (importOriginal) => ({
  ...await importOriginal<typeof Core>(),
  assertLiveWriteConfig: vi.fn(),
  loadGitHubAppConfig: vi.fn(),
}));
import { probeDockerVerificationRuntime } from '../apps/web/src/lib/server/verification-worker-runtime.js';

const id = `sha256:${'a'.repeat(64)}`;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APIPROOF_ENABLE_LIVE_GITHUB', 'true');
  vi.stubEnv('APIPROOF_ENABLE_LIVE_GITHUB_WRITE', 'true');
  vi.stubEnv('APIPROOF_SECRET', 'test-secret-not-forwarded');
  vi.stubEnv('DOCKER_PATH', 'C:\\Program Files\\Docker\\docker.exe');
  vi.stubEnv('DOCKER_CONTEXT', 'desktop-linux');
  execute.mockImplementation(async (_path: string, args: string[], options: { maxBuffer: number }) => {
    // Reproduce a CLI that sees the image only in the configured context.
    if (args[0] !== '--context' || args[1] !== 'desktop-linux') throw new Error('No such image');
    if (args.includes('info')) return { stdout: 'linux\r\n' };
    // Full image metadata exceeds the old 4 KiB bound; formatted ID does not.
    const stdout = args.includes('--format') ? `${id}\r\n` : JSON.stringify({ metadata: 'x'.repeat(8192) });
    if (Buffer.byteLength(stdout) > options.maxBuffer) throw Object.assign(new Error('stdout maxBuffer exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
    return { stdout };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('production Docker preflight', () => {
  it('uses the explicit Windows CLI/context and bounded formatted inspection', async () => {
    await expect(probeDockerVerificationRuntime()).resolves.toBeUndefined();
    expect(execute).toHaveBeenLastCalledWith('C:\\Program Files\\Docker\\docker.exe',
      ['--context', 'desktop-linux', 'image', 'inspect', 'node:22.14.0-alpine3.21', '--format', '{{.Id}}'],
      expect.objectContaining({ maxBuffer: 4096, timeout: 10000, windowsHide: true }));
    const options = execute.mock.calls[0]![2];
    expect(options.env.APIPROOF_SECRET).toBeUndefined();
    expect(execute.mock.calls.flatMap((call) => call[1])).not.toContain('pull');
  });

  it.each(['', 'not-an-image', 'sha256:abc'])('fails closed for invalid ID %j', async (stdout) => {
    execute.mockResolvedValueOnce({ stdout: 'linux' }).mockResolvedValueOnce({ stdout });
    await expect(probeDockerVerificationRuntime()).rejects.toThrow('VERIFICATION_PINNED_IMAGE_UNAVAILABLE');
  });

  it.each(['No such image', 'timeout', 'ENOENT', 'stdout maxBuffer exceeded'])('fails closed for inspection error %s', async (message) => {
    const cause = new Error(message);
    execute.mockResolvedValueOnce({ stdout: 'linux' }).mockRejectedValueOnce(cause);
    await expect(probeDockerVerificationRuntime()).rejects.toMatchObject({ message: 'VERIFICATION_PINNED_IMAGE_UNAVAILABLE', cause });
  });

  it('rejects a non-Linux engine before image inspection', async () => {
    execute.mockResolvedValueOnce({ stdout: 'windows' });
    await expect(probeDockerVerificationRuntime()).rejects.toThrow('VERIFICATION_DOCKER_LINUX_ENGINE_UNAVAILABLE');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves Linux executable and endpoint defaults', async () => {
    vi.stubEnv('DOCKER_PATH', '');
    vi.stubEnv('DOCKER_CONTEXT', '');
    vi.stubEnv('DOCKER_HOST', 'unix:///var/run/docker.sock');
    execute.mockResolvedValueOnce({ stdout: 'linux' }).mockResolvedValueOnce({ stdout: id });
    await probeDockerVerificationRuntime();
    expect(execute).toHaveBeenCalledWith('docker', ['info', '--format', '{{.OSType}}'],
      expect.objectContaining({ env: expect.objectContaining({ DOCKER_HOST: 'unix:///var/run/docker.sock' }) }));
  });
});
