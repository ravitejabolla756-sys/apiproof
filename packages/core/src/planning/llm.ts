import type { MigrationPlan, PlanningInput, ModelOutput } from '@apiproof/shared';
import { deterministicPlan } from './deterministic.js';
import { validateModelOutput, validatePlan } from './validator.js';

export const DEFAULT_MODEL_GENERATION_TIMEOUT_MS = 30_000;
export const MAX_MODEL_GENERATION_TIMEOUT_MS = 120_000;
const MODEL_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

export interface StructuredModelClient {
  readonly model: string;
  generate(input: { change: PlanningInput['change']; facts: PlanningInput['facts']; impacts: PlanningInput['impacts']; snippets: PlanningInput['snippets']; migrationInstructions: string[] }, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface LLMPlannerOptions {
  timeoutMs?: number;
}

export class LLMPlanner {
  private readonly timeoutMs: number;

  constructor(private readonly client: StructuredModelClient, options: LLMPlannerOptions = {}) {
    if (!MODEL_IDENTIFIER.test(client.model)) throw new Error('MODEL_IDENTIFIER_INVALID');
    const timeoutMs = options.timeoutMs ?? DEFAULT_MODEL_GENERATION_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_MODEL_GENERATION_TIMEOUT_MS) throw new Error('MODEL_GENERATION_TIMEOUT_INVALID');
    this.timeoutMs = timeoutMs;
  }

  private async generate(input: Parameters<StructuredModelClient['generate']>[0]): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('MODEL_GENERATION_TIMEOUT'));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([this.client.generate(input, { signal: controller.signal }), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async plan(input: PlanningInput): Promise<MigrationPlan> {
    if (!input.impacts.length || input.unresolvedQuestions.some((question) => question.includes('exact source usage'))) return deterministicPlan(input);
    const raw = await this.generate({ change: input.change, facts: input.facts, impacts: input.impacts, snippets: input.snippets, migrationInstructions: input.migrationInstructions });
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
