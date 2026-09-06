import type { MigrationPlan } from '@apiproof/shared';
import type { PlanningEvaluationResult } from '@apiproof/shared';

function safe(value: string): string { return value.replace(/[\p{Cc}\p{Cf}]/gu, '?'); }
function rate(value: number | null): string { return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`; }

export function formatPlan(plan: MigrationPlan): string {
  return [
    'APIProof Migration Plan', '', `Status: ${plan.status}`, `Change: ${plan.changeId}`, `Provider: ${plan.provider}`, `Repository: ${plan.repository}`, '',
    'Affected locations', ...plan.affectedLocations.map((location) => `  ${location.file}:${location.line}:${location.column} ${location.symbol}`),
    '', 'Deterministic facts', ...plan.facts.map((fact) => `  ${fact.statement}`),
    '', 'Steps', ...plan.steps.map((step) => `  ${step.id} [${step.kind}] ${step.description}`),
    '', 'Recommendations', ...plan.recommendations.map((item) => `  ${item.text}`),
    '', 'Evidence', ...plan.evidence.filter((item) => item.kind === 'official-source' || item.kind === 'impact').map((item) => `  ✓ ${item.label}`),
    '', `Planning evidence strength: ${plan.confidence.planningConfidence.toFixed(2)}`, `Analysis evidence strength: ${plan.confidence.analysisConfidence.toFixed(2)}`,
    '', 'Warnings', ...plan.warnings.map((warning) => `  ⚠ ${warning}`),
    '', 'Unresolved questions', ...(plan.unresolvedQuestions.length ? plan.unresolvedQuestions.map((question) => `  ? ${question}`) : ['  None recorded.']),
    '', 'Human review required. No source code was modified or executed.',
  ].map(safe).join('\n');
}

export function formatPlanningEvaluation(result: PlanningEvaluationResult): string {
  return [
    'Migration Planning Evaluation', '', `Cases: ${result.cases}`,
    `Schema-valid plans: ${result.schemaValidPlans}/${result.cases}`,
    `Correct affected locations: ${result.correctAffectedLocations}/${result.cases}`,
    `Correct plan statuses: ${result.correctStatuses}/${result.cases}`,
    `Correct change identity: ${result.correctChangeIdentity}/${result.cases}`,
    `Evidence-reference validity: ${result.invalidEvidenceReferences ? 'failed' : '100%'}`,
    `Unsupported fact inventions: ${result.unsupportedFactInventions}`,
    `Required-warning coverage: ${rate(result.requiredWarningCoverage)}`,
    `Planning failures: ${result.planningFailures}`,
    `Insufficient-evidence cases: ${result.insufficientEvidenceCases}`,
    '', ...result.results.filter((item) => item.error || !item.locationsCorrect || !item.warningsCovered).map((item) => `${item.id}: ${item.error ?? 'criteria not met'}`),
    '', 'Objective planning checks only; this is not a subjective migration-correctness score.',
  ].map(safe).join('\n');
}
