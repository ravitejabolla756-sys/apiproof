import { describe, expect, it, vi } from 'vitest';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';
import type { GitHubAppSourceControlProvider } from '@apiproof/core';

function provider(tree: string[], files: Record<string, string>, sha = 'baseline-sha') {
  return {
    getDefaultBranch: vi.fn().mockResolvedValue({ name: 'trunk', sha }),
    readTree: vi.fn().mockResolvedValue(tree),
    readFile: vi.fn().mockImplementation(async (filePath: string) => {
      if (!(filePath in files)) throw new Error('GITHUB_FILE_NOT_FOUND');
      return files[filePath];
    }),
  } as unknown as GitHubAppSourceControlProvider;
}

describe('Task 3 — fail-closed GitHub scan snapshots', () => {
  it('returns a complete source snapshot at the requested SHA', async () => {
    const source = provider(['package.json', 'src/index.ts'], {
      'package.json': '{"dependencies":{"stripe":"1.0.0"}}',
      'src/index.ts': 'export const value = 1;\n',
    });

    const result = await fetchRemoteRepositoryFiles(source, 'baseline-sha');

    expect(result.headSha).toBe('baseline-sha');
    expect(result.defaultBranch).toBe('trunk');
    expect(result.files.get('src/index.ts')).toBe('export const value = 1;\n');
  });

  it('rejects a partial snapshot when any analyzable source file cannot be read', async () => {
    const source = provider(['package.json', 'src/missing.ts'], {
      'package.json': '{}',
    });

    await expect(fetchRemoteRepositoryFiles(source, 'baseline-sha'))
      .rejects.toThrow('GITHUB_READ_FAILED:file:src/missing.ts@baseline-sha');
  });

  it('rejects binary source instead of reporting a successful scan', async () => {
    const source = provider(['src/binary.ts'], {
      'src/binary.ts': 'const binary = "\u0000";',
    });

    await expect(fetchRemoteRepositoryFiles(source, 'baseline-sha'))
      .rejects.toThrow('GITHUB_BINARY_FILE_UNSUPPORTED:src/binary.ts');
  });
});
