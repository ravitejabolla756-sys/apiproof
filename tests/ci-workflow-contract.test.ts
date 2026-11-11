import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCiWorkflowContract } from '../apps/web/scripts/release-manifest.js';

describe('CI workflow contract', () => {
  it('requires integration-branch validation with read-only permissions', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(validateCiWorkflowContract(workflow)).toEqual({ valid: true, missing: [], forbidden: [] });
  });

  it('rejects write permissions and missing required checks', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8')
      .replace('contents: read', 'contents: write')
      .replace('run: pnpm test', 'run: echo tests');
    expect(validateCiWorkflowContract(workflow)).toMatchObject({
      valid: false,
      missing: ['permissions:\n  contents: read', 'run: pnpm test'],
      forbidden: ['contents: write'],
    });
  });
});
