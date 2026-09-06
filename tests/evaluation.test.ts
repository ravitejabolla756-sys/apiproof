import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateMetrics, compareUsages, evaluateCorpus } from '@apiproof/core';
import { AnalysisError, CorpusSchema, EvaluationResultSchema } from '@apiproof/shared';
import { loadStripeRegistry } from '@apiproof/providers';
import { proof, repository, root } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
const corpus: unknown = JSON.parse(await readFile(path.join(root, 'evaluation/labels/cases.json'), 'utf8'));

describe('metric calculations', () => {
  it('calculates precision, recall, and F1 from independent confusion counts', () => {
    const metrics = calculateMetrics({ truePositives: 31, falsePositives: 3, trueNegatives: 34, falseNegatives: 4 });
    expect(metrics.precision).toBeCloseTo(31 / 34);
    expect(metrics.recall).toBeCloseTo(31 / 35);
    expect(metrics.f1).toBeCloseTo(62 / 69);
  });
  it('does not fabricate scores for zero denominators', () => {
    expect(calculateMetrics({ truePositives: 0, falsePositives: 0, trueNegatives: 4, falseNegatives: 0 })).toMatchObject({ precision: null, recall: null, f1: null });
    expect(calculateMetrics({ truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 1 })).toMatchObject({ precision: null, recall: 0, f1: 0 });
  });
  it('rejects negative and fractional counts', () => {
    expect(() => calculateMetrics({ truePositives: -1, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 })).toThrow();
    expect(() => calculateMetrics({ truePositives: 1.5, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 })).toThrow();
  });
  it('compares usage positions and symbols, deduplicating predictions', () => {
    const first = { file: 'src.ts', line: 3, column: 5, symbol: 'subscriptions.del' };
    const missed = { ...first, line: 4 };
    const extra = { ...first, symbol: 'invoices.retrieveUpcoming' };
    expect(compareUsages([first, missed], [first, first, extra])).toEqual({ truePositives: 1, missed: [missed], unexpected: [extra] });
  });
});

describe('corpus integrity and execution', () => {
  it('rejects inconsistent, duplicate and unsafe labels', () => {
    const valid = CorpusSchema.parse(corpus);
    const first = valid.cases[0]!;
    expect(CorpusSchema.safeParse({ ...valid, cases: [first, first] }).success).toBe(false);
    expect(CorpusSchema.safeParse({ ...valid, cases: [{ ...first, affected: false }] }).success).toBe(false);
    expect(CorpusSchema.safeParse({ ...valid, cases: [{ ...first, repository: '../outside' }] }).success).toBe(false);
  });
  it.each(['.env', '.secrets/config.ts', 'node_modules/stripe/index.ts', 'dist/generated.ts'])(
    'rejects labels pointing at excluded or sensitive input: %s', (file) => {
      const valid = CorpusSchema.parse(corpus);
      const first = valid.cases[0]!;
      expect(CorpusSchema.safeParse({ ...valid, cases: [{ ...first, expectedUsages: [{ ...first.expectedUsages[0], file }] }] }).success).toBe(false);
    },
  );
  it('evaluates all labels, preserves hard cases and fixes the four permanent regressions', async () => {
    const before = await readFile(path.join(root, 'evaluation/labels/cases.json'));
    const result = await evaluateCorpus(path.join(root, 'evaluation'), registry, proof);
    expect(EvaluationResultSchema.safeParse(result).success).toBe(true);
    expect(result.groundTruthCases).toBe(CorpusSchema.parse(corpus).cases.length);
    expect(result.repositories).toBe(new Set(CorpusSchema.parse(corpus).cases.map((item) => item.repository)).size);
    expect(result.failedCases).toBe(0);
    const baseline = JSON.parse(await readFile(path.join(root, 'evaluation/results/phase2-baseline.json'), 'utf8')) as {
      cases: Array<{ id: string; expectedAffected: boolean; expectedUsages: unknown[]; inputDigest: string }>;
    };
    for (const previous of baseline.cases) {
      const current = result.cases.find((item) => item.id === previous.id)!;
      expect(current.expectedAffected).toBe(previous.expectedAffected);
      expect(current.expectedUsages).toEqual(previous.expectedUsages);
      if (current.regressionId) expect(current.inputDigest).toBe(previous.inputDigest);
    }
    const observed = { truePositives: result.cases.filter((item) => item.outcome === 'TP').length,
      falsePositives: result.cases.filter((item) => item.outcome === 'FP').length,
      trueNegatives: result.cases.filter((item) => item.outcome === 'TN').length,
      falseNegatives: result.cases.filter((item) => item.outcome === 'FN').length };
    expect(result.metrics).toEqual(calculateMetrics(observed));
    expect(result.metrics.falseNegatives).toBeGreaterThan(0);
    for (const id of ['parameter-builder', 'promise-field', 'computed-method']) {
      expect(result.cases.find((item) => item.regressionId === `false-negative-${id}`)?.outcome).toBe('TP');
    }
    expect(result.cases.find((item) => item.regressionId === 'false-positive-capability-check')?.outcome).toBe('TN');
    for (const groups of [result.byChangeCategory, result.byEvidencePattern]) {
      expect(groups.reduce((sum, group) => sum + group.cases, 0)).toBe(result.groundTruthCases);
      for (const key of ['truePositives', 'falsePositives', 'trueNegatives', 'falseNegatives'] as const) {
        expect(groups.reduce((sum, group) => sum + group.metrics[key], 0)).toBe(result.metrics[key]);
      }
    }
    expect(await readFile(path.join(root, 'evaluation/labels/cases.json'))).toEqual(before);
  });
  it('rejects missing or draft change records before analysis', async () => {
    await expect(evaluateCorpus(path.join(root, 'evaluation'), [], proof)).rejects.toMatchObject({ code: 'UNREVIEWED_CHANGE' });
    await expect(evaluateCorpus(path.join(root, 'evaluation'), registry.map((item) => ({ ...item, review: { ...item.review, status: 'draft' } })), proof))
      .rejects.toMatchObject({ code: 'UNREVIEWED_CHANGE' });
  });
  it('reports execution failures separately instead of crediting true negatives', async () => {
    const directory = await repository();
    await mkdir(path.join(directory, 'labels'));
    await mkdir(path.join(directory, 'corpus/sample'), { recursive: true });
    const labels = CorpusSchema.parse(corpus);
    labels.cases = [{ ...labels.cases[0]!, id: 'failed-case', repository: 'corpus/sample', changeId: registry[0]!.id, affected: false,
      explanation: 'This test exercises evaluation failure accounting.', expectedUsages: [] }];
    await writeFile(path.join(directory, 'labels/cases.json'), JSON.stringify(labels));
    const result = await evaluateCorpus(directory, registry, { impact: async () => { throw new AnalysisError('TEST_FAILURE', 'Simulated analyzer failure'); } });
    expect(result.failedCases).toBe(1);
    expect(result.scoredCases).toBe(0);
    expect(result.metrics.trueNegatives).toBe(0);
    expect(result.metrics.precision).toBeNull();
    expect(result.cases[0]).toMatchObject({ outcome: 'ERROR', predictedAffected: null });
  });
});
