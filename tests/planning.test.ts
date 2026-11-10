import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildPlanningContext, DeterministicPlanner, LLMPlanner, validateModelOutput, evaluatePlanningCorpus } from '@apiproof/core';
import { MigrationPlanSchema, PlanningInputSchema } from '@apiproof/shared';
import { loadStripeRegistry } from '@apiproof/providers';
import { proof, repository, root } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
const prefix = "import Stripe from 'stripe';\nconst client = new Stripe(process.env.KEY!);\n";
function change(id: string) { const value = registry.find((item) => item.id === `stripe-${id}`); if (!value) throw new Error('missing registry change'); return value; }

async function inputFor(source: string, id = 'subscription-coupon-removed') {
  const directory = await repository({ 'package.json': '{"dependencies":{"stripe":"17.7.0"}}', 'src.ts': prefix + source });
  const impact = await proof.impact(directory, change(id));
  return { directory, input: await buildPlanningContext(directory, impact) };
}

describe('deterministic migration planning', () => {
  it('separates deterministic facts from evidence-linked recommendations', async () => {
    const { directory, input } = await inputFor("client.subscriptions.create({ coupon: 'launch' });");
    const before = await readFile(path.join(directory, 'src.ts'));
    const plan = await new DeterministicPlanner().plan(input);
    expect(await readFile(path.join(directory, 'src.ts'))).toEqual(before);
    expect(MigrationPlanSchema.parse(plan)).toBeTruthy();
    expect(plan.status).toBe('PLAN_READY');
    expect(plan.facts.some((fact) => fact.kind === 'parameter' && fact.statement.includes('coupon'))).toBe(true);
    expect(plan.recommendations[0]?.supportedBy.every((id) => plan.evidence.some((entry) => entry.id === id))).toBe(true);
    expect(plan.recommendations[0]?.unsupportedSpeculation).toBe(false);
    expect(plan.requiresHumanReview).toBe(true);
    expect(plan.generatedBy.modelReasoningUsed).toBe(false);
  });

  it('does not fabricate a replacement when registry structure is insufficient', async () => {
    const { input } = await inputFor("client.invoices.retrieveUpcoming({});", 'invoice-upcoming-removed');
    const plan = await new DeterministicPlanner().plan(input);
    expect(plan.status).toBe('PLAN_NEEDS_REVIEW');
    expect(plan.steps[0]?.kind).toBe('inspect');
    expect(plan.steps[0]?.suggestedField).toBeUndefined();
    expect(plan.unresolvedQuestions).toEqual([]);
  });

  it('returns insufficient evidence for an inconclusive impact', async () => {
    const { input } = await inputFor("function preview(method: string) { return client.invoices[method]({}); }", 'invoice-upcoming-removed');
    expect(input.impacts).toHaveLength(0);
    const plan = await new DeterministicPlanner().plan(input);
    expect(plan.status).toBe('PLAN_INSUFFICIENT_EVIDENCE');
    expect(plan.recommendations).toHaveLength(0);
    expect(plan.unresolvedQuestions.join(' ')).toContain('exact source usage');
  });
});

describe('bounded planning context', () => {
  it('redacts environment references and secret-like literals while keeping bounded source evidence', async () => {
    const { input } = await inputFor("const token = 'sk_live_very_secret';\nclient.subscriptions.create({ coupon: 'launch' });");
    expect(PlanningInputSchema.parse(input)).toBeTruthy();
    expect(input.snippets[0]?.text).not.toContain('process.env.KEY');
    expect(input.snippets[0]?.text).not.toContain('sk_live_very_secret');
    expect(input.snippets[0]?.text).toContain('[REDACTED_SECRET]');
    expect(input.snippets.reduce((sum, snippet) => sum + snippet.text.length, 0)).toBeLessThanOrEqual(input.bounds.maxTotalChars);
    expect(input.facts.some((fact) => fact.kind === 'package' && fact.statement.includes('17.7.0'))).toBe(true);
  });
});

describe('LLM planner boundary and hallucination guards', () => {
  it('accepts a deterministic fake provider only when it cites supplied evidence', async () => {
    const { input } = await inputFor("client.subscriptions.create({ coupon: 'launch' });");
    const impactEvidence = input.evidence.find((item) => item.kind === 'impact')!;
    const planner = new LLMPlanner({ model: 'fake-test-model', generate: async () => ({
      summary: 'Review the affected subscription call.',
      steps: [{ id: 'step-1', kind: 'transform', affectedSymbol: 'subscriptions.create', description: 'Update the affected subscription parameter.', evidenceIds: [impactEvidence.id], assumptions: [], risks: [], unresolvedQuestions: [] }],
      recommendations: [{ text: 'Use the reviewed discount replacement and verify business behavior.', evidenceIds: [impactEvidence.id] }],
      assumptions: [], risks: [], unresolvedQuestions: [],
    }) });
    const plan = await planner.plan(input);
    expect(plan.generatedBy).toMatchObject({ planner: 'llm', model: 'fake-test-model', modelReasoningUsed: true, validationStatus: 'validated' });
    expect(plan.requiresHumanReview).toBe(true);
    expect(plan.status).toBe('PLAN_NEEDS_REVIEW');
  });

  it('rejects invented symbols, files and evidence references', async () => {
    const { input } = await inputFor("client.subscriptions.create({ coupon: 'launch' });");
    const evidence = input.evidence[0]!.id;
    expect(() => validateModelOutput({ summary: 'Bad output', steps: [{ id: 'step-1', kind: 'transform', affectedSymbol: 'subscriptions.create', description: 'Update src/other.ts.', evidenceIds: [evidence], assumptions: [], risks: [], unresolvedQuestions: [] }], recommendations: [], assumptions: [], risks: [], unresolvedQuestions: [] }, input)).toThrow(/source file/);
    expect(() => validateModelOutput({ summary: 'Bad output', steps: [{ id: 'step-1', kind: 'transform', affectedSymbol: 'subscriptions.create', affectedParameter: 'unrelated', description: 'Update the affected parameter.', evidenceIds: [evidence], assumptions: [], risks: [], unresolvedQuestions: [] }], recommendations: [], assumptions: [], risks: [], unresolvedQuestions: [] }, input)).toThrow(/symbols, parameters/);
    expect(() => validateModelOutput({ summary: 'Bad output', steps: [], recommendations: [{ text: 'Unsupported suggestion.', evidenceIds: ['impact:invented'] }], assumptions: [], risks: [], unresolvedQuestions: [] }, input)).toThrow(/outside the bounded context/);
  });

  it('rejects duplicate model step identifiers before they enter a migration plan', async () => {
    const { input } = await inputFor("client.subscriptions.create({ coupon: 'launch' });");
    const evidenceId = input.evidence.find((item) => item.kind === 'impact')!.id;
    const step = { id: 'step-1', kind: 'inspect', affectedSymbol: 'subscriptions.create', description: 'Inspect the affected subscription call.', evidenceIds: [evidenceId], assumptions: [], risks: [], unresolvedQuestions: [] };
    expect(() => validateModelOutput({ summary: 'Review the affected call.', steps: [step, step], recommendations: [], assumptions: [], risks: [], unresolvedQuestions: [] }, input)).toThrow(/duplicate step identifiers/);
  });

  it('rejects malformed output and propagates provider failures without weakening deterministic planning', async () => {
    const { input } = await inputFor("client.subscriptions.create({ coupon: 'launch' });");
    expect(() => validateModelOutput({ summary: 'missing required fields' }, input)).toThrow(/structured planning schema/);
    await expect(new LLMPlanner({ model: 'failing-test-model', generate: async () => { throw new Error('provider timeout SECRET=must-not-leak'); } }).plan(input))
      .rejects.toMatchObject({ code: 'MODEL_PROVIDER_FAILED', message: 'Model provider failed.' });
    await expect(new LLMPlanner({ model: 'failing-test-model', generate: async () => { throw new Error('provider timeout SECRET=must-not-leak'); } }).plan(input))
      .rejects.not.toThrow('SECRET=must-not-leak');
    expect((await new DeterministicPlanner().plan(input)).status).toBe('PLAN_READY');
  });
});

describe('planning corpus harness', () => {
  it('scores objective planning properties without reusing impact metrics', async () => {
    const result = await evaluatePlanningCorpus(path.join(root, 'evaluation-plans'), registry, { plan: async (repositoryPath, selectedChange) => proof.plan(repositoryPath, selectedChange) });
    expect(result.cases).toBe(6);
    expect(result.schemaValidPlans).toBe(6);
    expect(result.correctAffectedLocations).toBe(6);
    expect(result.correctStatuses).toBe(6);
    expect(result.correctChangeIdentity).toBe(6);
    expect(result.invalidEvidenceReferences).toBe(0);
    expect(result.unsupportedFactInventions).toBe(0);
    expect(result.requiredWarningCoverage).toBe(1);
    expect(result.planningFailures).toBe(0);
    expect(result.insufficientEvidenceCases).toBe(2);
  });
});
