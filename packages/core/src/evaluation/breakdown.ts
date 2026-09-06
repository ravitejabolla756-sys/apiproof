import type { EvaluationResult } from '@apiproof/shared';
import { calculateMetrics, compareUsages } from './metrics.js';

/** One scoring policy shared by overall totals and every partition. */
export function scoreCases(group: EvaluationResult['cases']) {
    const count = (outcome: string) => group.filter((item) => item.outcome === outcome).length;
    const comparisons = group.filter((item) => item.outcome !== 'ERROR').map((item) => compareUsages(item.expectedUsages, item.predictedUsages));
    const usage = calculateMetrics({ truePositives: comparisons.reduce((sum, item) => sum + item.truePositives, 0),
      falsePositives: comparisons.reduce((sum, item) => sum + item.unexpected.length, 0),
      falseNegatives: comparisons.reduce((sum, item) => sum + item.missed.length, 0), trueNegatives: 0 });
    return {
      metrics: calculateMetrics({ truePositives: count('TP'), falsePositives: count('FP'), trueNegatives: count('TN'), falseNegatives: count('FN') }),
      usageMetrics: { truePositives: usage.truePositives, falsePositives: usage.falsePositives, falseNegatives: usage.falseNegatives,
        precision: usage.precision, recall: usage.recall, f1: usage.f1 },
      inconclusiveCases: group.filter((item) => item.status === 'inconclusive').length, failedCases: count('ERROR') };
}

/** Groups partition cases once; failures and inconclusives retain the overall policy. */
export function breakdown(cases: EvaluationResult['cases'], field: 'changeCategory' | 'evidencePattern'): EvaluationResult['byChangeCategory'] {
  return [...new Set(cases.map((item) => item[field]))].sort().map((name) => {
    const group = cases.filter((item) => item[field] === name);
    return { name, cases: group.length, ...scoreCases(group) };
  });
}
