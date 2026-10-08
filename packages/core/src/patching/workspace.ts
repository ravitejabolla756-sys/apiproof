import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { AnalysisError } from '@apiproof/shared';
import { allowedPatchPath, assertPlainPath, fail, fixtureSha256, sha256 } from './policy.js';

export const patchToolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
export const patchCorpusRoot = path.join(patchToolRoot, 'evaluation-patches');
/** Writable runtime state must not be derived from the package/build location. */
export const patchWorkspaceRunsRoot = path.join(os.tmpdir(), 'apiproof', 'patch-runs');
const MAX_WORKSPACE_FILES = 500;
const MAX_WORKSPACE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 32 * 1024 * 1024;
export interface FixtureManifest { schemaVersion: '1.0'; fixtures: Record<string, Record<string, string>> }
export interface PatchWorkspace { readonly runId: string; readonly repositoryId: string; readonly directory: string; readonly originalDirectory: string; readonly snapshot: Readonly<Record<string, string>> }
const issued = new WeakSet<PatchWorkspace>();

/** Bounded source/config inputs suitable for deterministic patching and verification. */
export function isVerificationWorkspacePath(file: string): boolean {
  if (!file || file.startsWith('/') || file.includes('\\') || file.split('/').some((part) => !part || part === '.' || part === '..')) return false;
  const parts = file.split('/');
  const lower = file.toLowerCase();
  const basename = parts.at(-1)!;
  if (parts.some((part) => /^(?:node_modules|\.git|\.next|dist|build|coverage|vendor|secrets?|credentials?)$/i.test(part))) return false;
  if (basename.toLowerCase().startsWith('.env') || /\.(?:pem|key|p12|pfx|env)$/i.test(lower) || /(?:secret|credential|password|token)/i.test(basename)) return false;
  if (allowedPatchPath(file)) return true;
  if (basename === 'package.json') return true;
  if (/^tsconfig(?:\.[A-Za-z0-9_-]+)?\.json$/i.test(basename)) return true;
  if (parts.length === 1 && ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'pnpm-workspace.yaml', '.npmrc', '.yarnrc.yml', '.yarnrc.yaml'].includes(basename)) return true;
  return /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(basename);
}

export function assertVerificationWorkspaceBounds(files: ReadonlyMap<string, string>): void {
  if (!files.size || files.size > MAX_WORKSPACE_FILES) throw new Error('VERIFICATION_WORKSPACE_FILE_LIMIT: Source snapshot exceeds the bounded verification workspace limit.');
  let totalBytes = 0;
  for (const [file, content] of files) {
    if (!isVerificationWorkspacePath(file)) throw new Error(`VERIFICATION_WORKSPACE_PATH_REJECTED: ${file}`);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_WORKSPACE_FILE_BYTES) throw new Error(`VERIFICATION_WORKSPACE_FILE_LIMIT: ${file} exceeds the per-file size limit.`);
    if (isPackageManagerMetadata(file) && hasEmbeddedCredential(content)) throw new Error(`VERIFICATION_CREDENTIAL_MATERIAL_REJECTED: Sensitive material detected in ${file}.`);
    totalBytes += bytes;
    if (totalBytes > MAX_WORKSPACE_BYTES) throw new Error('VERIFICATION_WORKSPACE_SIZE_LIMIT: Source snapshot exceeds the total verification workspace limit.');
  }
}

function isPackageManagerMetadata(file: string): boolean {
  return file.endsWith('/package.json') || file === 'package.json' || file === 'pnpm-lock.yaml' || file === 'package-lock.json' || file === 'yarn.lock' || file === 'pnpm-workspace.yaml' || file === '.npmrc' || file === '.yarnrc.yml' || file === '.yarnrc.yaml';
}

function hasEmbeddedCredential(content: string): boolean {
  return /https?:\/\/[^\s/@]+:[^\s/@]+@/i.test(content)
    || /(?:_authToken|npmAuthToken|npmAuthIdent|private_key|password|authorization)\s*[:=]\s*["']?[^\s"']+/i.test(content);
}

export async function loadFixtureManifest(): Promise<FixtureManifest> {
  const file = path.join(patchCorpusRoot, 'manifest.json'); await assertPlainPath(file);
  return JSON.parse(await readFile(file, 'utf8')) as FixtureManifest;
}
async function inventory(root: string, relative = ''): Promise<string[]> {
  await assertPlainPath(path.join(root, relative));
  const files: string[] = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = [relative, entry.name].filter(Boolean).join('/');
    await assertPlainPath(path.join(root, name));
    if (entry.isDirectory()) files.push(...await inventory(root, name)); else files.push(name);
    if (files.length > 100) fail('FIXTURE_SIZE_LIMIT');
  }
  return files.sort();
}
async function ensurePatchWorkspaceRunsRoot(): Promise<string> {
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, path.resolve(patchWorkspaceRunsRoot));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('WORKSPACE_TEMP_PATH_INVALID');
  let parent = tempRoot;
  await assertPlainPath(tempRoot);
  for (const part of ['apiproof', 'patch-runs']) {
    parent = path.join(parent, part);
    await mkdir(parent).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    await assertPlainPath(parent);
  }
  return parent;
}
/** Resolve a fixed, bundled repository resource without assuming a build root exists. */
export async function resolveBundledResource(...relativeParts: string[]): Promise<string> {
  const relative = path.join(...relativeParts);
  const candidates = [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), '..', '..', relative),
    path.join(patchToolRoot, relative),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    await assertPlainPath(candidate);
    return candidate;
  }
  throw new Error(`BUNDLED_RESOURCE_UNAVAILABLE: ${relative}`);
}
export async function createPatchWorkspace(repository: string): Promise<PatchWorkspace> {
  const manifest = await loadFixtureManifest();
  const originalDirectory = path.resolve(repository);
  const id = Object.keys(manifest.fixtures).find((key) => /^[a-z0-9-]+$/.test(key) && path.relative(path.join(patchCorpusRoot, 'corpus', key), originalDirectory) === '');
  if (!id) throw new AnalysisError('FIXTURE_ONLY', 'Phase 4 patching is restricted to APIProof-owned fixture repositories.');
  const expected = manifest.fixtures[id]!;
  if (JSON.stringify(await inventory(originalDirectory)) !== JSON.stringify(Object.keys(expected).sort())) fail('FIXTURE_MANIFEST_MISMATCH');
  const snapshot: Record<string, string> = {};
  for (const [file, digest] of Object.entries(expected)) {
    if (!allowedPatchPath(file) && !['package.json', 'package-lock.json'].includes(file)) fail('FIXTURE_MANIFEST_PATH');
    const bytes = await readFile(path.join(originalDirectory, file));
    if (bytes.length > 1_048_576 || bytes.includes(0) || fixtureSha256(bytes) !== digest) fail('FIXTURE_DIGEST_MISMATCH');
    snapshot[file] = bytes.toString('utf8');
  }
  // Create ancestors one at a time and validate before descending; never follow a preexisting junction.
  const parent = await ensurePatchWorkspaceRunsRoot();
  const runId = randomUUID(); const run = path.join(parent, runId);
  await mkdir(run); const directory = path.join(run, 'repository'); await mkdir(directory);
  await mkdir(path.join(directory, 'node_modules')); await mkdir(path.join(directory, '.verification-cache'));
  for (const [file, text] of Object.entries(snapshot)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await assertPlainPath(path.dirname(path.join(directory, file)));
    await writeFile(path.join(directory, file), text, { flag: 'wx' });
  }
  const workspace = Object.freeze({ runId, repositoryId: id, directory, originalDirectory, snapshot: Object.freeze(snapshot) }); issued.add(workspace); return workspace;
}

/**
 * Creates an isolated workspace from a caller-provided, already authenticated
 * source snapshot. The fixture-only entry point above remains fixture-only;
 * this entry point is for the live GitHub migration path after the caller has
 * bound the snapshot to an exact commit SHA.
 */
export async function createSourcePatchWorkspace(repositoryId: string, files: Readonly<Record<string, string>>): Promise<PatchWorkspace> {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length || entries.length > 500) fail('WORKSPACE_FILE_SET_INVALID');
  assertVerificationWorkspaceBounds(new Map(entries));
  const snapshot: Record<string, string> = {};
  for (const [file, text] of entries) {
    if (!assertSafeWorkspaceFile(file) || !isVerificationWorkspacePath(file)) fail('WORKSPACE_PATH_INVALID');
    if (Buffer.byteLength(text, 'utf8') > 2_097_152 || text.includes('\0')) fail('WORKSPACE_FILE_INVALID');
    snapshot[file] = text;
  }
  const parent = await ensurePatchWorkspaceRunsRoot();
  const runId = randomUUID(); const run = path.join(parent, runId);
  await mkdir(run); const originalDirectory = path.join(run, 'baseline'); const directory = path.join(run, 'repository');
  await mkdir(originalDirectory); await mkdir(directory);
  await mkdir(path.join(directory, 'node_modules')); await mkdir(path.join(directory, '.verification-cache'));
  for (const [file, text] of entries) {
    for (const root of [originalDirectory, directory]) {
      const destination = path.join(root, file); await mkdir(path.dirname(destination), { recursive: true }); await assertPlainPath(path.dirname(destination));
      await writeFile(destination, text, { flag: 'wx' });
    }
  }
  const workspace = Object.freeze({ runId, repositoryId, directory, originalDirectory, snapshot: Object.freeze(snapshot) }); issued.add(workspace); return workspace;
}

/**
 * Removes a live patch workspace after the caller has finished with it.
 * The run id is generated internally, and the containment check prevents a
 * caller from turning cleanup into an arbitrary recursive delete.
 */
export async function cleanupPatchWorkspace(workspace: PatchWorkspace): Promise<void> {
  if (!issued.has(workspace)) return;
  const runsRoot = path.resolve(patchWorkspaceRunsRoot);
  const runRoot = path.resolve(path.join(runsRoot, workspace.runId));
  if (path.relative(runsRoot, runRoot) !== workspace.runId) fail('WORKSPACE_CLEANUP_PATH_INVALID');
  await rm(runRoot, { recursive: true, force: true });
  issued.delete(workspace);
}

function assertSafeWorkspaceFile(file: string): boolean {
  return Boolean(file) && !path.isAbsolute(file) && !file.includes('\\') && !file.split('/').some((part) => !part || part === '.' || part === '..');
}
export async function checkWorkspace(workspace: PatchWorkspace, expected = workspace.snapshot): Promise<void> {
  if (!issued.has(workspace)) fail('UNISSUED_WORKSPACE');
  if (JSON.stringify(await inventory(workspace.directory)) !== JSON.stringify(Object.keys(expected).sort())) fail('WORKSPACE_FILE_SET_CHANGED');
  for (const [file, text] of Object.entries(expected)) {
    if (sha256(await readFile(path.join(workspace.directory, file))) !== sha256(text)) fail('SOURCE_DIGEST_MISMATCH');
    await assertPlainPath(path.join(workspace.originalDirectory, file));
    if (sha256(await readFile(path.join(workspace.originalDirectory, file))) !== sha256(workspace.snapshot[file]!)) fail('ORIGINAL_FIXTURE_CHANGED');
  }
}
export async function workspaceFileNames(workspace: PatchWorkspace): Promise<string[]> {
  if (!issued.has(workspace)) fail('UNISSUED_WORKSPACE');
  return inventory(workspace.directory);
}

/** Ensure verification did not rewrite any captured source or configuration input. */
export async function findWorkspaceContentDrift(workspace: PatchWorkspace, resultingFiles: Readonly<Record<string, string>>): Promise<string[]> {
  if (!issued.has(workspace)) fail('UNISSUED_WORKSPACE');
  const changed: string[] = [];
  for (const [file, baseline] of Object.entries(workspace.snapshot)) {
    const target = path.join(workspace.directory, file);
    try {
      await assertPlainPath(target);
      const expected = resultingFiles[file] ?? baseline;
      if (sha256(await readFile(target)) !== sha256(expected)) changed.push(file);
    } catch {
      changed.push(file);
    }
  }
  return changed;
}
