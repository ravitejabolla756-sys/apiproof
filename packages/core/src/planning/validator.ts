import { AnalysisError, MigrationPlanSchema, ModelOutputSchema } from '@apiproof/shared';
import type { MigrationPlan, ModelOutput, PlanningInput } from '@apiproof/shared';

function allowedEvidence(input: PlanningInput): Set<string> { return new Set(input.evidence.map((item) => item.id)); }
function allowedSymbols(input: PlanningInput): Set<string> { return new Set(input.impacts.map((item) => item.symbol)); }

export function validatePlan(plan: MigrationPlan, input: PlanningInput): MigrationPlan {
  const evidence = allowedEvidence(input);
  const symbols = allowedSymbols(input);
  if (plan.requiresHumanReview !== true) throw new AnalysisError('INVALID_PLAN', 'Migration plans must require human review.');
  if (plan.changeId !== input.change.id || plan.provider !== input.change.provider) throw new AnalysisError('INVALID_PLAN_FACT', 'Plan identity does not match the reviewed change record.');
  for (const reference of [...plan.recommendations.flatMap((item) => item.supportedBy), ...plan.steps.flatMap((item) => item.supportedBy), ...plan.generatedBy.evidenceIds]) {
    if (!evidence.has(reference)) throw new AnalysisError('INVALID_PLAN_EVIDENCE', 'Plan contains an evidence reference outside its bounded planning context.');
  }
  for (const location of plan.affectedLocations) if (!input.impacts.some((item) => item.location.file === location.file && item.location.start.line === location.line && item.location.start.column === location.column && item.symbol === location.symbol)) throw new AnalysisError('INVALID_PLAN_FACT', 'Plan contains an affected location outside deterministic impact evidence.');
  for (const step of plan.steps) if (!symbols.has(step.location.symbol)) throw new AnalysisError('INVALID_PLAN_FACT', 'Plan contains an affected symbol outside deterministic impact evidence.');
  const sourceFiles = new Set(input.snippets.map((item) => item.file));
  for (const text of [...plan.assumptions, ...plan.warnings, ...plan.unresolvedQuestions, ...plan.recommendations.map((item) => item.text), ...plan.steps.map((item) => item.description)]) {
    const paths = text.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|mts|cts)/g) ?? [];
    if (paths.some((file) => !sourceFiles.has(file))) throw new AnalysisError('INVALID_PLAN_FACT', 'Plan mentions a source file outside bounded evidence.');
  }
  return MigrationPlanSchema.parse(plan);
}

export function validateModelOutput(input: unknown, context: PlanningInput): ModelOutput {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(input); } catch { throw new AnalysisError('INVALID_MODEL_OUTPUT', 'Model output could not be serialized safely.'); }
  if (!serialized || new TextEncoder().encode(serialized).byteLength > 512 * 1024) throw new AnalysisError('INVALID_MODEL_OUTPUT', 'Model output exceeded the bounded planning response size.');
  const parsed = ModelOutputSchema.safeParse(input);
  if (!parsed.success) throw new AnalysisError('INVALID_MODEL_OUTPUT', 'Model output did not match the structured planning schema.');
  const evidence = allowedEvidence(context); const symbols = allowedSymbols(context);
  const parameters = new Set(context.facts.filter((fact) => fact.kind === 'parameter' && fact.symbol).map((fact) => fact.statement.replace(/^Affected parameter: /, '').replace(/\.$/, '')));
  const files = new Set(context.snippets.map((snippet) => snippet.file));
  for (const step of parsed.data.steps) {
    if (!symbols.has(step.affectedSymbol) || (step.affectedParameter && !parameters.has(step.affectedParameter)) || step.evidenceIds.some((id) => !evidence.has(id))) throw new AnalysisError('INVALID_MODEL_FACT', 'Model output attempted to redefine deterministic symbols, parameters or evidence.');
    const mentionedFiles = step.description.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|mts|cts)/g) ?? [];
    if (mentionedFiles.some((file) => !files.has(file))) throw new AnalysisError('INVALID_MODEL_FACT', 'Model output mentioned a source file outside bounded evidence.');
  }
  for (const recommendation of parsed.data.recommendations) {
    if (recommendation.evidenceIds.some((id) => !evidence.has(id))) throw new AnalysisError('INVALID_MODEL_EVIDENCE', 'Model recommendation cites evidence outside the bounded context.');
    const mentionedFiles = recommendation.text.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|mts|cts)/g) ?? [];
    if (mentionedFiles.some((file) => !files.has(file))) throw new AnalysisError('INVALID_MODEL_FACT', 'Model recommendation mentioned a source file outside bounded evidence.');
  }
  return parsed.data;
}
