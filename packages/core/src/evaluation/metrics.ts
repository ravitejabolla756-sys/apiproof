import type { Metrics, ExpectedUsage } from '@apiproof/shared';

/** Undefined denominators are null, never an invented 100% score. */
export function calculateMetrics(counts: Pick<Metrics, 'truePositives' | 'falsePositives' | 'trueNegatives' | 'falseNegatives'>): Metrics {
  for (const value of Object.values(counts)) if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Counts must be nonnegative safe integers.');
  const { truePositives: tp, falsePositives: fp, falseNegatives: fn } = counts;
  const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
  return { ...counts, precision: divide(tp, tp + fp), recall: divide(tp, tp + fn), f1: divide(2 * tp, 2 * tp + fp + fn) };
}

export function usageKey(usage: ExpectedUsage): string { return JSON.stringify([usage.file, usage.line, usage.column, usage.symbol]); }

export function compareUsages(expected: ExpectedUsage[], predicted: ExpectedUsage[]) {
  const expectedMap = new Map(expected.map((item) => [usageKey(item), item]));
  const predictedMap = new Map(predicted.map((item) => [usageKey(item), item]));
  return {
    truePositives: [...expectedMap.keys()].filter((key) => predictedMap.has(key)).length,
    missed: [...expectedMap].filter(([key]) => !predictedMap.has(key)).map(([, item]) => item),
    unexpected: [...predictedMap].filter(([key]) => !expectedMap.has(key)).map(([, item]) => item),
  };
}
