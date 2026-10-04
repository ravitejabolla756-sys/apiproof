import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDockerRunArgs, DockerSandbox } from '../packages/core/src/verification/sandbox.js';
import { runDockerProcess } from '../packages/core/src/verification/docker-process.js';
import type * as DockerProcess from '../packages/core/src/verification/docker-process.js';

vi.mock('../packages/core/src/verification/docker-process.js', async (importOriginal) => ({ ...await importOriginal<typeof DockerProcess>(), runDockerProcess: vi.fn() }));
const requests = (['INSTALL', 'BUILD', 'TYPECHECK', 'TEST'] as const).map((stage) => ({ stage, cwd: 'controlled-workspace', argv: ['node', '-e', 'process.exit(0)'], env: {}, limits: { timeoutMs: 90000, memoryMb: 768, maxOutputBytes: 65536, cpu: 'bounded' } }));
const execution = (code: number, stdout = '') => ({ code, stdout, stderr: '', durationMs: 1, timedOut: false, stdoutTruncated: false, stderrTruncated: false });

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());
describe('Docker CLI sequence control-plane regression', () => {
  it('uses the configured executable for execution and cleanup', async () => {
    vi.stubEnv('DOCKER_PATH', 'C:\\Program Files\\Docker\\docker.exe');
    vi.mocked(runDockerProcess).mockResolvedValue(execution(0));
    await new DockerSandbox().runSequence(requests);
    expect(vi.mocked(runDockerProcess).mock.calls.length).toBeGreaterThan(2);
    expect(vi.mocked(runDockerProcess).mock.calls.every(([binary]) => binary === process.env.DOCKER_PATH)).toBe(true);
  });
  it('mounts package artifacts read-only and keeps dependency/project bookkeeping container-local', () => {
    const args = buildDockerRunArgs({ ...requests[0]!, dependencyProvisioning: { packageManager: 'pnpm', root: 'controlled-artifacts', inputDigest: 'a'.repeat(64), artifactDigest: 'b'.repeat(64) } }, requests[0]!.limits);
    expect(args).toContain('type=bind,src=controlled-artifacts,dst=/provisioned-dependencies,readonly=true');
    expect(args).toContain('/workspace/node_modules:rw,exec,nosuid,size=512m');
    expect(args).toContain('/provisioned-dependencies/pnpm-store/v10/projects:rw,noexec,nosuid,size=4m');
    expect(args.filter((arg) => arg.startsWith('type=bind,')).every((arg) => arg.endsWith('readonly=true'))).toBe(true);
  });
  it('uses one isolated container and process exit status, never repository stdout markers', async () => {
    vi.mocked(runDockerProcess).mockImplementation(async (_docker, args) => {
      if (args[0] === 'exec' && vi.mocked(runDockerProcess).mock.calls.filter((call) => call[1][0] === 'exec').length === 4) return execution(137, '\n__APIPROOF_STAGE__TEST:0:1234567890000\n');
      return execution(0);
    });
    const report = await new DockerSandbox().runSequence(requests);
    expect(report.map((step) => step.status)).toEqual(['PASSED', 'PASSED', 'PASSED', 'FAILED']);
    expect(report[3]?.exitCode).toBe(137);
    const args = vi.mocked(runDockerProcess).mock.calls.map((call) => call[1]);
    expect(args.filter((call) => call[0] === 'run')).toHaveLength(1);
    expect(args[0]).toEqual(expect.arrayContaining(['--detach', '--pull=never', '--network=none', '--read-only']));
    expect(args.at(-1)?.slice(0, 2)).toEqual(['rm', '--force']);
    const container = args[0]![args[0]!.indexOf('--name') + 1];
    expect(container).toMatch(/^apiproof-verification-/);
    expect(args.filter((call) => call[0] === 'exec').every((call) => call.includes(container!))).toBe(true);
  });
  it('does not execute later gates after a timeout and always cleans up its owned container', async () => {
    vi.mocked(runDockerProcess).mockResolvedValueOnce(execution(0)).mockResolvedValueOnce({ ...execution(137), timedOut: true }).mockResolvedValue(execution(0));
    const report = await new DockerSandbox().runSequence(requests);
    expect(report).toHaveLength(1); expect(report[0]?.status).toBe('TIMED_OUT');
    expect(vi.mocked(runDockerProcess).mock.calls.at(-1)?.[1].slice(0, 2)).toEqual(['rm', '--force']);
  });
});
