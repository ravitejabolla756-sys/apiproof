import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCiWorkflowContract } from '../apps/web/scripts/release-manifest.js';

describe('CI workflow contract', () => {
  it('requires integration-branch validation with read-only permissions', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(validateCiWorkflowContract(workflow)).toEqual({ valid: true, missing: [], forbidden: [] });
  });

  it('bounds hosted work and cancels superseded runs', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('concurrency:');
    expect(workflow).toContain('cancel-in-progress: true');
    expect(workflow).toContain('timeout-minutes: 30');
    expect(workflow).toContain('uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
    expect(workflow).toContain('uses: pnpm/action-setup@0c17529a66aca453f9227af23103ed11469b1e47');
    expect(workflow).toContain('uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020');
    expect(workflow).not.toMatch(/uses:\s+[^\s]+@(v\d|main|master)(?:\s|$)/m);
    expect(workflow).not.toContain('pull_request_target:');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toMatch(/-----BEGIN [A-Z0-9 ]+ PRIVATE KEY-----/);
    expect(workflow).not.toMatch(/GITHUB_APP_PRIVATE_KEY\s*:/);
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
