import type { EvaluationResult } from '@apiproof/shared';

export function formatEvaluation(result: EvaluationResult): string {
  const rate = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
  const groupLines = (groups: EvaluationResult['byChangeCategory']) => groups.map((group) =>
    `${group.name} (${group.cases}): TP ${group.metrics.truePositives}; FP ${group.metrics.falsePositives}; TN ${group.metrics.trueNegatives}; FN ${group.metrics.falseNegatives}; ` +
    `precision ${rate(group.metrics.precision)}; recall ${rate(group.metrics.recall)}; F1 ${rate(group.metrics.f1)}; ` +
    `usage P/R/F1 ${rate(group.usageMetrics.precision)}/${rate(group.usageMetrics.recall)}/${rate(group.usageMetrics.f1)}; inconclusive ${group.inconclusiveCases}; failed ${group.failedCases}`);
  return [
    'APIProof Evaluation', '',
    `Repositories: ${result.repositories}`, `Change records: ${result.changeRecords}`, `Ground-truth cases: ${result.groundTruthCases}`, '',
    `True positives: ${result.metrics.truePositives}`, `False positives: ${result.metrics.falsePositives}`,
    `True negatives: ${result.metrics.trueNegatives}`, `False negatives: ${result.metrics.falseNegatives}`, '',
    `Precision: ${rate(result.metrics.precision)}`, `Recall:    ${rate(result.metrics.recall)}`, `F1:        ${rate(result.metrics.f1)}`, '',
    `Usage precision: ${rate(result.usageMetrics.precision)}; recall: ${rate(result.usageMetrics.recall)}; F1: ${rate(result.usageMetrics.f1)}`,
    `Inconclusive cases: ${result.inconclusiveCases}; failed cases: ${result.failedCases}`,
    `Scored cases: ${result.scoredCases}/${result.groundTruthCases}; failures are excluded and cause exit code 1.`,
    '', 'By change category', ...groupLines(result.byChangeCategory), '', 'By evidence pattern', ...groupLines(result.byEvidencePattern), '',
    ...result.cases.filter((item) => item.outcome === 'FP' || item.outcome === 'FN' || item.unexpectedUsages.length || item.missedUsages.length)
      .map((item) => `${item.outcome} ${item.id}: ${item.explanation}`),
    'Metrics measure this authored corpus, not general production accuracy. Inconclusive cases remain in the denominator.',
  ].map((line) => line.replace(/[\p{Cc}\p{Cf}]/gu, '?')).join('\n');
}
