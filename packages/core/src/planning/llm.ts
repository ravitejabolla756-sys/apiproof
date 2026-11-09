import { AnalysisError } from '@apiproof/shared';
import type { MigrationPlan, PlanningInput, ModelOutput } from '@apiproof/shared';
import { deterministicPlan } from './deterministic.js';
import { validateModelOutput, validatePlan } from './validator.js';

export interface StructuredModelClient {
  readonly model: string;
  generate(input: { change: PlanningInput['change']; facts: PlanningInput['facts']; impacts: PlanningInput['impacts']; snippets: PlanningInput['snippets']; migrationInstructions: string[] }): Promise<unknown>;
}

export class LLMPlanner {
  constructor(private readonly client: StructuredModelClient) {}

  async plan(input: PlanningInput): Promise<MigrationPlan> {
    if (!input.impacts.length || input.unresolvedQuestions.some((question) => question.includes('exact source usage'))) return deterministicPlan(input);
    let raw: unknown;
    try {
      raw = await this.client.generate({ change: input.change, facts: input.facts, impacts: input.impacts, snippets: input.snippets, migrationInstructions: input.migrationInstructions });
    } catch {
      throw new AnalysisError('MODEL_PROVIDER_FAILED', 'Model provider failed.');
    }
    const output: ModelOutput = validateModelOutput(raw, input);
    const base = deterministicPlan(input);
    const bySymbol = new Map(input.impacts.map((impact) => [impact.symbol, impact]));
    const steps = output.steps.map((step) => {
      const impact = bySymbol.get(step.affectedSymbol)!;
      return { id: step.id, kind: step.kind, description: step.description, location: { file: impact.location.file, line: impact.location.start.line, column: impact.location.start.column, symbol: impact.symbol }, supportedBy: step.evidenceIds, ...(step.affectedParameter ? { currentField: step.affectedParameter } : {}) };
    });
    const recommendations = output.recommendations.map((item, index) => ({ id: `recommendation-${index + 1}`, text: item.text, supportedBy: item.evidenceIds, unsupportedSpeculation: false as const }));
    return validatePlan({ ...base, status: 'PLAN_NEEDS_REVIEW', steps, recommendations, assumptions: [...base.assumptions, ...output.assumptions], warnings: [...base.warnings, ...output.risks], unresolvedQuestions: [...base.unresolvedQuestions, ...output.unresolvedQuestions],
      confidence: { ...base.confidence, planningConfidence: Math.min(base.confidence.planningConfidence, 0.7), basis: [...base.confidence.basis, 'A model supplied recommendations; deterministic validation retained locations and evidence.'] },
      generatedBy: { ...base.generatedBy, planner: 'llm', model: this.client.model, modelReasoningUsed: true, generatedAt: new Date().toISOString() } }, input);
  }
}
