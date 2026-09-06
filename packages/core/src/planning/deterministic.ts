import { createHash } from 'node:crypto';
import { TOOL_VERSION, MigrationPlanSchema } from '@apiproof/shared';
import type { ChangeRule, MigrationPlan, PlanningInput, PlanStep, PlanRecommendation } from '@apiproof/shared';
import { validatePlan } from './validator.js';

export interface MigrationPlanner {
  plan(input: PlanningInput): Promise<MigrationPlan>;
}

export class DeterministicPlanner implements MigrationPlanner {
  async plan(input: PlanningInput): Promise<MigrationPlan> { return deterministicPlan(input); }
}

function digest(input: PlanningInput): string { return createHash('sha256').update(JSON.stringify(input.change)).digest('hex'); }
function location(input: PlanningInput, symbol: string) {
  const impact = input.impacts.find((item) => item.symbol === symbol) ?? input.impacts[0];
  if (!impact) return undefined;
  return { file: impact.location.file, line: impact.location.start.line, column: impact.location.start.column, symbol: impact.symbol };
}
function ruleFor(input: PlanningInput, symbol: string): ChangeRule | undefined {
  return input.change.rules?.find((rule) => 'symbol' in rule && rule.symbol === symbol);
}

export function deterministicPlan(input: PlanningInput): MigrationPlan {
  const evidenceIds = input.evidence.map((item) => item.id);
  const locations = input.impacts.map((item) => ({ file: item.location.file, line: item.location.start.line, column: item.location.start.column, symbol: item.symbol }));
  const steps: PlanStep[] = []; const recommendations: PlanRecommendation[] = []; const assumptions = [...input.change.assumptions];
  const directStructured = input.impacts.length > 0 && input.impacts.every((impact) => {
    const rule = ruleFor(input, impact.symbol);
    return !!rule && (('replacementPath' in rule && !!rule.replacementPath) || ('replacementSymbol' in rule && !!rule.replacementSymbol));
  });
  for (const [index, impact] of input.impacts.entries()) {
    const rule = ruleFor(input, impact.symbol); const stepLocation = location(input, impact.symbol); if (!stepLocation) continue;
    const supportedBy = [`impact:${impact.usageId}`, `fact:location:${impact.usageId}`].filter((id) => evidenceIds.includes(id));
    const replacement = rule && ('replacementPath' in rule ? rule.replacementPath : 'replacementSymbol' in rule ? rule.replacementSymbol : undefined);
    const current = rule && ('path' in rule ? rule.path : 'symbol' in rule ? rule.symbol : impact.symbol);
    const description = replacement ? `Update ${impact.symbol} at ${stepLocation.file}:${stepLocation.line} by replacing ${current} with ${replacement}.` : `Inspect ${impact.symbol} at ${stepLocation.file}:${stepLocation.line} using the reviewed migration instructions.`;
    steps.push({ id: `step-${index + 1}`, kind: replacement ? 'transform' : 'inspect', description, location: stepLocation, supportedBy, ...(current ? { currentField: current } : {}), ...(replacement ? { suggestedField: replacement } : {}) });
    if (replacement) recommendations.push({ id: `recommendation-${index + 1}`, text: `Replace ${current} with the structured replacement ${replacement}; exact syntax and surrounding business behavior require human review.`, supportedBy: [...supportedBy, `change:${input.change.id}`], unsupportedSpeculation: false });
    else recommendations.push({ id: `recommendation-${index + 1}`, text: 'Review the supplied migration instructions at this affected location; the registry does not contain enough structured replacement data to fabricate syntax.', supportedBy: [...supportedBy, `change:${input.change.id}`], unsupportedSpeculation: false });
  }
  const warnings = [...input.warnings, 'Plan has not been executed.', 'No source code has been modified.', 'Human review is required; this plan is not proof of a safe migration.'];
  const unresolved = [...input.unresolvedQuestions];
  if (!input.impacts.length || input.unresolvedQuestions.some((question) => question.includes('exact source usage'))) unresolved.push('The deterministic analyzer did not establish an affected usage; no migration transformation is proposed.');
  const status = input.impacts.length === 0 || input.unresolvedQuestions.some((question) => question.includes('exact source usage')) ? 'PLAN_INSUFFICIENT_EVIDENCE' : directStructured ? 'PLAN_READY' : 'PLAN_NEEDS_REVIEW';
  const average = input.impacts.length ? input.impacts.reduce((sum, item) => sum + item.confidence, 0) / input.impacts.length : 0;
  const plan = MigrationPlanSchema.parse({ changeId: input.change.id, provider: input.change.provider, repository: input.repository, status,
    affectedLocations: locations, facts: input.facts, recommendations, steps, assumptions, warnings, unresolvedQuestions: unresolved, evidence: input.evidence,
    confidence: { analysisConfidence: average, planningConfidence: directStructured ? 0.9 : input.impacts.length ? 0.65 : 0, evidenceCoverage: input.impacts.length ? Math.min(1, input.snippets.length / input.impacts.length) : 0,
      basis: [directStructured ? 'Structured registry replacement metadata is present.' : 'Registry instructions require human interpretation.', 'All recommendations link to deterministic evidence.'] },
    generatedBy: { planner: 'deterministic', version: TOOL_VERSION, model: null, generatedAt: new Date().toISOString(), evidenceIds, changeDigest: digest(input), analysisDigest: input.analysisDigest, modelReasoningUsed: false, validationStatus: 'validated' }, requiresHumanReview: true });
  return validatePlan(plan, input);
}
