import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cleanupPatchWorkspace, createSourcePatchWorkspace } from '@apiproof/core';
import { validateExactMigrationSource, validatePersistedMigrationEvidence } from '../apps/web/src/lib/server/migration-verification.js';

describe('evidence-bound migration boundary', () => {
  const sha = 'a'.repeat(40);
  const source = 'export const value = 1;';
  const sourceDigest = 'fcbcb7aece718d280178457c2c5a3bfb8e8743b8331374c29a50397f38d511e4';

  it('accepts the exact baseline/path/source binding', () => {
    // Digest is computed by the production helper; this assertion intentionally
    // uses a known source and verifies the normal success boundary below.
    expect(() => validateExactMigrationSource({ expectedBaselineSha: sha, actualBaselineSha: sha, expectedPath: 'src/a.ts', actualPath: 'src/a.ts', source, expectedSourceDigest: sourceDigest })).not.toThrow();
  });

  it.each([
    ['wrong baseline SHA', { expectedBaselineSha: sha, actualBaselineSha: 'b'.repeat(40) }],
    ['wrong target path', { expectedPath: 'src/a.ts', actualPath: 'src/b.ts' }],
    ['missing source file', { source: undefined }],
    ['wrong source digest', { expectedSourceDigest: '0'.repeat(64) }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => validateExactMigrationSource({ expectedBaselineSha: sha, actualBaselineSha: sha, expectedPath: 'src/a.ts', actualPath: 'src/a.ts', source, expectedSourceDigest: sourceDigest, ...overrides })).toThrow();
  });

  it('fails closed for missing, stale, and mismatched persisted evidence', () => {
    expect(() => validatePersistedMigrationEvidence(undefined, { repositoryId: '1', baselineSha: sha, changeId: 'change', patchDigest: 'digest' })).toThrow(/GITHUB_EVIDENCE_MISSING/);
    expect(() => validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: sha, patchDigest: 'old', report: { status: 'VERIFICATION_PASSED' } }), { repositoryId: '1', baselineSha: sha, changeId: 'change', patchDigest: 'digest' })).toThrow(/GITHUB_EVIDENCE_STALE/);
  });

  it('cleans up an isolated source workspace after the caller finishes', async () => {
    const workspace = await createSourcePatchWorkspace('repository-test', {
      'src/a.ts': 'export const value = 1;',
      'package.json': '{"private":true}',
    });
    const directory = workspace.directory;
    await expect(fs.stat(directory)).resolves.toBeDefined();
    await cleanupPatchWorkspace(workspace);
    await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
