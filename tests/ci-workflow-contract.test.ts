import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCiWorkflowContract } from '../apps/web/scripts/release-manifest.js';

describe('CI workflow contract', () => {
  it('requires integration and release-candidate validation with read-only permissions', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(validateCiWorkflowContract(workflow)).toEqual({ valid: true, missing: [], forbidden: [] });
  });

  it('rejects a workflow that omits the release-candidate trigger', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8')
      .replace(', codex/v1-release-candidate', '');
    expect(validateCiWorkflowContract(workflow)).toMatchObject({
      valid: false,
      missing: ['push:\n    branches: [ main, codex/v1-integration, codex/v1-release-candidate ]'],
      forbidden: [],
    });
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

  it('keeps scheduled jobs bounded and outside pull-request secret execution', () => {
    const workflow = readFileSync(path.resolve(import.meta.dirname, '../.github/workflows/my-owl-scheduler.yml'), 'utf8').replaceAll('\r\n', '\n');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('concurrency:\n  group: my-owl-scheduler');
    expect(workflow).toContain('timeout-minutes: 10');
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toContain('MY_OWL_APP_URL: ${{ vars.MY_OWL_APP_URL }}');
    expect(workflow).toContain('WORKER_AUTH_SECRET: ${{ secrets.WORKER_AUTH_SECRET }}');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('pull_request_target:');
    expect(workflow).not.toContain('vercel --prod');
    expect(workflow).toContain('test -n "$MY_OWL_APP_URL"');
    expect(workflow).toContain('test -n "$WORKER_AUTH_SECRET"');
    expect(workflow).toContain('x-apiproof-worker-signature');
  });
});
