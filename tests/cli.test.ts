import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ImpactResultSchema, ScanResultSchema } from '@apiproof/shared';
import { EvaluationResultSchema, MigrationPlanSchema, PlanningEvaluationResultSchema } from '@apiproof/shared';
import { fixture, root } from './helpers.js';

const execute = promisify(execFile);
// The CLI is intentionally exercised through a real child process. Under the
// full Vitest pool, several TypeScript workers can start at once, so the
// process budget must cover startup contention without changing assertions.
const CLI_TIMEOUT_MS = 120_000;
function cli(args: string[]) {
  return execute(process.execPath, ['--import', 'tsx', '--conditions=apiproof-source', 'apps/cli/src/index.ts', ...args], {
    cwd: root, timeout: CLI_TIMEOUT_MS, maxBuffer: 1_048_576, windowsHide: true,
  });
}

describe('CLI contract', () => {
  it('emits a clean machine-readable scan', async () => {
    const result = await cli(['scan', fixture('affected'), '--json']);
    expect(result.stderr).toBe('');
    expect(ScanResultSchema.parse(JSON.parse(result.stdout)).providerUsed).toBe(true);
  });

  it('emits an impact report and readable output', async () => {
    const args = ['impact', fixture('affected'), '--change', path.join(root, 'fixtures/stripe-change.json')];
    const json = await cli([...args, '--json']);
    expect(ImpactResultSchema.parse(JSON.parse(json.stdout)).impacts).toHaveLength(1);
    const readable = await cli(args);
    expect(readable.stdout).toContain('potentially-affected');
    expect(readable.stdout).toContain('src/customer.ts:6:10');
    expect(readable.stdout).toContain('synthetic');
    expect(readable.stdout).toContain('\n    AST binding resolves');
  }, CLI_TIMEOUT_MS);

  it('returns JSON input errors with exit code 2', async () => {
    await expect(cli(['impact', fixture('affected'), '--json'])).rejects.toMatchObject({
      code: 2, stderr: '', stdout: expect.stringContaining('INVALID_ARGUMENTS'),
    });
  });

  it('safely rejects missing changes and unknown flags', async () => {
    await expect(cli(['impact', fixture('affected'), '--change', 'missing.json', '--json'])).rejects.toMatchObject({
      code: 2, stdout: expect.stringContaining('INVALID_CHANGE_FILE'),
    });
    await expect(cli(['scan', fixture('affected'), '--bad-flag', '--json'])).rejects.toMatchObject({
      code: 2, stdout: expect.stringContaining('INVALID_ARGUMENTS'),
    });
  });

  it('offers help and version without scanning', async () => {
    expect((await cli(['--help'])).stdout).toContain('apiproof scan');
    expect(JSON.parse((await cli(['--version', '--json'])).stdout)).toEqual({ version: '0.7.0' });
  });

  it('selects a reviewed change by ID and prints structured evidence', async () => {
    const result = await cli(['impact', path.join(root, 'evaluation/corpus/discounts-update'), '--change-id', 'stripe-subscription-coupon-removed', '--json']);
    const impact = ImpactResultSchema.parse(JSON.parse(result.stdout));
    expect(impact.impacts[0]?.reasonCodes).toContain('AFFECTED_PARAMETER_PRESENT');
  });

  it('evaluates the corpus with clean JSON output', async () => {
    const result = await cli(['evaluate', '--json']);
    expect(result.stderr).toBe('');
    const evaluation = EvaluationResultSchema.parse(JSON.parse(result.stdout));
    expect(evaluation.groundTruthCases).toBeGreaterThan(0);
    expect(evaluation.metrics.recall).not.toBeNull();
  });

  it('generates a read-only migration plan and evaluates planning criteria', async () => {
    const plan = await cli(['plan', path.join(root, 'evaluation-plans/corpus/coupon-direct'), '--change-id', 'stripe-subscription-coupon-removed', '--json']);
    const parsedPlan = MigrationPlanSchema.parse(JSON.parse(plan.stdout));
    expect(parsedPlan.status).toBe('PLAN_READY');
    expect(parsedPlan.requiresHumanReview).toBe(true);
    expect(parsedPlan.generatedBy.modelReasoningUsed).toBe(false);
    const evaluation = await cli(['evaluate-plans', '--json']);
    const parsedEvaluation = PlanningEvaluationResultSchema.parse(JSON.parse(evaluation.stdout));
    expect(parsedEvaluation.cases).toBe(6);
    expect(parsedEvaluation.schemaValidPlans).toBe(6);
    expect(parsedEvaluation.correctStatuses).toBe(6);
  });

  it('does not silently enable an external model provider', async () => {
    await expect(cli(['plan', path.join(root, 'evaluation-plans/corpus/coupon-direct'), '--change-id', 'stripe-subscription-coupon-removed', '--with-model', '--json']))
      .rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('MODEL_UNAVAILABLE') });
    await expect(cli(['evaluate-plans', '--with-model', '--json']))
      .rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('MODEL_UNAVAILABLE') });
  }, CLI_TIMEOUT_MS);

  it('rejects conflicting change selectors and unknown IDs', async () => {
    await expect(cli(['impact', fixture('affected'), '--change', 'fixtures/stripe-change.json', '--change-id', 'missing', '--json']))
      .rejects.toMatchObject({ code: 2, stdout: expect.stringContaining('INVALID_ARGUMENTS') });
    await expect(cli(['impact', fixture('affected'), '--change-id', 'missing', '--json']))
      .rejects.toMatchObject({ code: 2, stdout: expect.stringContaining('INVALID_CHANGE_ID') });
  }, CLI_TIMEOUT_MS);
});
