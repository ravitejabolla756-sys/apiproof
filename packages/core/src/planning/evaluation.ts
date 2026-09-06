import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { readJsonFile, AnalysisError, PlanningCorpusSchema, PlanningEvaluationResultSchema, MigrationPlanSchema } from '@apiproof/shared';
import type { MigrationPlan, PlanningEvaluationResult, PlanningCorpus, RegistryChange } from '@apiproof/shared';

export interface PlanningRunner { plan(repository: string, change: RegistryChange): Promise<MigrationPlan> }

function locationKey(value: { file: string; line: number; column: number; symbol: string }): string { return JSON.stringify([value.file, value.line, value.column, value.symbol]); }
function compareLocations(expected: PlanningCorpus['cases'][number]['expectedLocations'], actual: MigrationPlan['affectedLocations']): boolean {
  const a = new Set(actual.map(locationKey)); const e = new Set(expected.map(locationKey));
  return a.size === e.size && [...e].every((item) => a.has(item));
}

export async function evaluatePlanningCorpus(directory: string, changes: RegistryChange[], runner: PlanningRunner): Promise<PlanningEvaluationResult> {
  const parsed = PlanningCorpusSchema.safeParse(await readJsonFile(path.join(directory, 'labels/cases.json'), directory, 1_048_576));
  if (!parsed.success) throw new AnalysisError('INVALID_PLANNING_CORPUS', 'Planning corpus labels violate the planning schema.');
  const corpus = parsed.data; const registry = new Map(changes.map((item) => [item.id, item])); const root = await realpath(directory);
  const results: PlanningEvaluationResult['results'] = [];
  for (const item of corpus.cases) {
    let status = 'PLAN_GENERATION_FAILED'; let schemaValid = false; let locationsCorrect = false; let statusCorrect = false; let changeIdentityCorrect = false; let evidenceValid = false; const unsupportedFactInventions = 0; let warningsCovered = false; let error: string | null = null;
    const change = registry.get(item.changeId);
    try {
      if (!change) throw new AnalysisError('UNREVIEWED_CHANGE', 'Planning case references an unavailable reviewed registry record.');
      const requested = await realpath(path.resolve(root, item.repository)); const relative = path.relative(root, requested);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new AnalysisError('INVALID_PLANNING_PATH', 'Planning repository escapes corpus boundary.');
      const plan = await runner.plan(requested, change);
      schemaValid = MigrationPlanSchema.safeParse(plan).success; status = plan.status;
      locationsCorrect = compareLocations(item.expectedLocations, plan.affectedLocations);
      statusCorrect = status === item.expectedStatus;
      changeIdentityCorrect = plan.changeId === item.changeId && plan.provider === change.provider;
      const ids = new Set(plan.evidence.map((entry) => entry.id)); evidenceValid = plan.recommendations.every((entry) => entry.supportedBy.every((id) => ids.has(id))) && plan.steps.every((entry) => entry.supportedBy.every((id) => ids.has(id)));
      warningsCovered = item.requiredWarningFragments.every((fragment) => plan.warnings.some((warning) => warning.includes(fragment)));
      if (!schemaValid || !evidenceValid || plan.requiresHumanReview !== true) throw new AnalysisError('INVALID_PLAN', 'Planner output failed deterministic validation.');
    } catch (cause) { error = cause instanceof AnalysisError ? cause.code : 'PLAN_GENERATION_FAILED'; }
    results.push({ id: item.id, status, expectedStatus: item.expectedStatus, schemaValid, locationsCorrect, statusCorrect, changeIdentityCorrect, evidenceValid, unsupportedFactInventions, warningsCovered, error });
  }
  const rate = results.length ? results.filter((item) => item.warningsCovered).length / results.length : null;
  return PlanningEvaluationResultSchema.parse({ schemaVersion: '1.0', corpusId: corpus.id, cases: results.length,
    schemaValidPlans: results.filter((item) => item.schemaValid).length, correctAffectedLocations: results.filter((item) => item.locationsCorrect).length, correctStatuses: results.filter((item) => item.statusCorrect).length,
    correctChangeIdentity: results.filter((item) => item.changeIdentityCorrect).length, invalidEvidenceReferences: results.filter((item) => !item.evidenceValid).length,
    unsupportedFactInventions: results.reduce((sum, item) => sum + item.unsupportedFactInventions, 0), requiredWarningCoverage: rate,
    planningFailures: results.filter((item) => item.error !== null).length, insufficientEvidenceCases: results.filter((item) => item.status === 'PLAN_INSUFFICIENT_EVIDENCE').length, results });
}
