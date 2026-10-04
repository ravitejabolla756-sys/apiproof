import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildVerificationWorkspaceCommands, type VerificationWorkspaceCommands } from './workspace.js';
import { VERIFICATION_DOCKER_IMAGE } from './sandbox.js';
import { resolveDockerPath, runDockerProcess } from './docker-process.js';
import { FINALIZE_ARTIFACTS_SCRIPT } from './artifact-integrity.js';
import { assertVerificationWorkspaceBounds } from '../patching/workspace.js';

export interface DependencyProvisioning {
  readonly packageManager: VerificationWorkspaceCommands['packageManager'];
  readonly root: string;
  readonly inputDigest: string;
  readonly artifactDigest: string;
}

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function provisioningInputs(files: ReadonlyMap<string, string>): Record<string, string> {
  return Object.fromEntries([...files.entries()]
    .filter(([file]) => file === 'package.json' || file.endsWith('/package.json') || /^(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|pnpm-workspace\.yaml|\.npmrc|\.yarnrc(?:\.yml|\.yaml))$/.test(file))
    .sort(([a], [b]) => a.localeCompare(b)));
}

function inputDigest(files: ReadonlyMap<string, string>): string {
  return digest(JSON.stringify(provisioningInputs(files)));
}

/**
 * Provision package artifacts in a networked Docker helper. The helper receives
 * only package metadata, has lifecycle scripts disabled, and never runs source
 * files. Its output is consumed read-only by the network-disabled verifier.
 */
export async function provisionVerificationDependencies(
  files: ReadonlyMap<string, string>,
  commands: VerificationWorkspaceCommands,
  options: { dockerPath?: string } = {},
): Promise<DependencyProvisioning> {
  assertVerificationWorkspaceBounds(files);
  const canonical = buildVerificationWorkspaceCommands(commands.id, files);
  if (JSON.stringify(canonical) !== JSON.stringify(commands)) throw new Error('VERIFICATION_PROVISIONING_POLICY_REJECTED: Commands do not match captured metadata.');
  const root = path.join(os.tmpdir(), `apiproof-provision-${randomUUID()}`);
  const name = `apiproof-provision-${randomUUID()}`;
  const dockerPath = options.dockerPath ?? resolveDockerPath();
  let completed = false;
  try {
  await mkdir(root, { recursive: true });
  const sourceRoot = path.join(root, 'source');
  const outputRoot = path.join(root, 'artifacts');
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  await mkdir(path.join(sourceRoot, 'node_modules'), { recursive: true });
  await mkdir(path.join(sourceRoot, '.yarn'), { recursive: true });
  for (const [file, content] of Object.entries(provisioningInputs(files))) {
    const target = path.join(sourceRoot, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
  }
  const runner = commands.packageManager === 'npm' ? ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', '/provision/npm-cache']
    : commands.packageManager === 'pnpm' ? commands.commands.install.slice(0, 2).concat(['fetch', '--frozen-lockfile', '--store-dir', '/provision/pnpm-store'])
      : commands.commands.install.slice(0, 2).concat(['install', '--frozen-lockfile', '--ignore-scripts', '--cache-folder', '/provision/yarn-cache']);
  const args = ['run', '--rm', '--name', name, '--pull=never', '--network=bridge', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit', '64', '--memory', '768m', '--cpus', '1', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--tmpfs', '/workspace/node_modules:rw,nosuid,size=512m', '--mount', `type=bind,src=${sourceRoot},dst=/workspace,readonly=true`, '--mount', `type=bind,src=${outputRoot},dst=/provision`, '--workdir', '/workspace', '--env', 'COREPACK_ENABLE_NETWORK=1', '--env', 'COREPACK_HOME=/provision/corepack', '--env', 'HOME=/tmp', '--env', 'YARN_ENABLE_SCRIPTS=0', VERIFICATION_DOCKER_IMAGE, ...runner];
  const result = await runDockerProcess(dockerPath, args, { cwd: sourceRoot, timeoutMs: 120000, maxOutputBytes: 65536 });
  if (result.code !== 0 || result.timedOut) throw new Error(`VERIFICATION_PROVISIONING_FAILED: Package artifact acquisition ${result.timedOut ? 'timed out' : `failed (Docker exit ${result.code ?? 'unavailable'})`}.`);
  const input = inputDigest(files);
  const hashed = await runDockerProcess(dockerPath, ['run', '--rm', '--name', `${name}-integrity`, '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory', '768m', '--mount', `type=bind,src=${outputRoot},dst=/provision`, VERIFICATION_DOCKER_IMAGE, 'node', '-e', FINALIZE_ARTIFACTS_SCRIPT, '/provision'], { cwd: sourceRoot, timeoutMs: 120000, maxOutputBytes: 4096 });
  if (hashed.code !== 0 || hashed.timedOut || !/^[a-f0-9]{64}$/.test(hashed.stdout)) {
    const category = hashed.stderr.match(/Cache symlink escapes provisioning \([A-Za-z0-9./@_+-]+\)|Unsupported cache entry|ENOENT|EACCES|EIO|SyntaxError|Out of memory|Operation not permitted/)?.[0] ?? 'invalid digest output';
    throw new Error(`VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Package cache could not be hashed (${category}; exit ${hashed.code ?? 'unavailable'}; timedOut=${hashed.timedOut}).`);
  }
  const artifacts = hashed.stdout;
  await writeFile(path.join(outputRoot, 'provisioning.json'), JSON.stringify({ packageManager: commands.packageManager, inputDigest: input, artifactDigest: artifacts }));
  completed = true;
  return { packageManager: commands.packageManager, root: outputRoot, inputDigest: input, artifactDigest: artifacts };
  } finally {
    await runDockerProcess(dockerPath, ['rm', '--force', name], { cwd: root, timeoutMs: 10000, maxOutputBytes: 4096 });
    await runDockerProcess(dockerPath, ['rm', '--force', `${name}-integrity`], { cwd: root, timeoutMs: 10000, maxOutputBytes: 4096 });
    if (!completed) await rm(root, { recursive: true, force: true });
  }
}

export async function cleanupProvisionedDependencies(provisioning: DependencyProvisioning): Promise<void> {
  const parent = path.dirname(provisioning.root);
  if (path.basename(parent).startsWith('apiproof-provision-')) await rm(parent, { recursive: true, force: true });
}

export function computeProvisioningInputDigest(files: ReadonlyMap<string, string>): string { return inputDigest(files); }

export async function assertProvisioningIntegrity(provisioning: DependencyProvisioning, expectedPackageManager: VerificationWorkspaceCommands['packageManager'], workspace?: string): Promise<void> {
  let metadata: { packageManager?: string; inputDigest?: string; artifactDigest?: string };
  try { metadata = JSON.parse(await readFile(path.join(provisioning.root, 'provisioning.json'), 'utf8')) as typeof metadata; }
  catch { throw new Error('VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Provisioning manifest is missing or invalid.'); }
  const required = expectedPackageManager === 'pnpm' ? 'pnpm-store' : expectedPackageManager === 'npm' ? 'npm-cache' : 'yarn-cache';
  try { await readdir(path.join(provisioning.root, required)); } catch { throw new Error('VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Required package artifacts are missing.'); }
  if (metadata.packageManager !== expectedPackageManager || provisioning.packageManager !== expectedPackageManager || metadata.inputDigest !== provisioning.inputDigest || metadata.artifactDigest !== provisioning.artifactDigest || !/^[a-f0-9]{64}$/.test(provisioning.artifactDigest)) {
    throw new Error('VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Provisioned artifacts do not match the captured package-manager inputs.');
  }
  if (workspace) {
    const files = new Map<string, string>();
    const walk = async (directory: string, prefix = ''): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (['node_modules', '.verification-cache', '.git'].includes(entry.name)) continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + '/');
        else if (Object.keys(provisioningInputs(new Map([[relative, '']]))).length) files.set(relative, await readFile(path.join(directory, entry.name), 'utf8'));
      }
    };
    await walk(workspace);
    if (inputDigest(files) !== provisioning.inputDigest) throw new Error('VERIFICATION_PROVISIONING_INTEGRITY_FAILED: Captured manifests or lockfile differ from provisioned inputs.');
  }
}
