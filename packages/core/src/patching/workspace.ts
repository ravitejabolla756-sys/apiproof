import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalysisError } from '@apiproof/shared';
import { allowedPatchPath, assertPlainPath, fail, sha256 } from './policy.js';

export const patchToolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
export const patchCorpusRoot = path.join(patchToolRoot, 'evaluation-patches');
export interface FixtureManifest { schemaVersion: '1.0'; fixtures: Record<string, Record<string, string>> }
export interface PatchWorkspace { readonly runId: string; readonly repositoryId: string; readonly directory: string; readonly originalDirectory: string; readonly snapshot: Readonly<Record<string, string>> }
const issued = new WeakSet<PatchWorkspace>();

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
    if (bytes.length > 1_048_576 || bytes.includes(0) || sha256(bytes) !== digest) fail('FIXTURE_DIGEST_MISMATCH');
    snapshot[file] = bytes.toString('utf8');
  }
  // Create ancestors one at a time and validate before descending; never follow a preexisting junction.
  let parent = patchToolRoot; await assertPlainPath(parent);
  for (const part of ['.tmp', 'patch-runs']) {
    parent = path.join(parent, part); await mkdir(parent).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; }); await assertPlainPath(parent);
  }
  const runId = randomUUID(); const run = path.join(parent, runId);
  await mkdir(run); const directory = path.join(run, 'repository'); await mkdir(directory);
  for (const [file, text] of Object.entries(snapshot)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await assertPlainPath(path.dirname(path.join(directory, file)));
    await writeFile(path.join(directory, file), text, { flag: 'wx' });
  }
  const workspace = Object.freeze({ runId, repositoryId: id, directory, originalDirectory, snapshot: Object.freeze(snapshot) }); issued.add(workspace); return workspace;
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
