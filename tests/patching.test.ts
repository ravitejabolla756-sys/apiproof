import { readFile, writeFile, symlink, rename } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CandidatePatchSchema } from '@apiproof/shared';
import { loadStripeRegistry, loadTwilioRegistry } from '@apiproof/providers';
import { allowedPatchPath, createPatchWorkspace, createSourcePatchWorkspace, cleanupPatchWorkspace, buildPatchContext, deterministicPlan, DeterministicPatchGenerator, LLMPatchGenerator, FakeStructuredPatchModel, validateCandidate, applyCandidate, evaluatePatchCase, patchCases, checkWorkspace, runFixturePatch, redactPatchContext, syntaxValid, targetsFor, unifiedDiff, editDiff } from '@apiproof/core';
import { proof, root, repository } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
const labels = await patchCases();
const fixture = path.join(root, 'evaluation-patches/corpus/coupon-basic');
async function setup(id = 'coupon-basic', changeId = 'stripe-subscription-coupon-removed') {
  const workspace = await createPatchWorkspace(path.join(root, 'evaluation-patches/corpus', id));
  const planning = await proof.planningInput(workspace.directory, registry.find((c) => c.id === changeId)!);
  const input = await buildPatchContext(workspace, planning, deterministicPlan(planning));
  const patch = await new DeterministicPatchGenerator().generate(input);
  return { workspace, input, patch };
}
describe('patch paths', () => {
  it.each(['src/billing.ts', 'src/routes/billing.ts', 'src/Widget.tsx', 'src/billing.test.ts', 'tests/billing.spec.ts'])('allows %s', (file) => expect(allowedPatchPath(file)).toBe(true));
  it.each(['src/CON.ts', 'src/aux.ts', 'src/COM1.ts', 'src/LPT9/file.ts'])('rejects Windows device path %s', (file) => expect(allowedPatchPath(file)).toBe(false));
  it.each(['../../README.md', '../src/a.ts', '/src/a.ts', 'C:/src/a.ts', 'C:\\src\\a.ts', '\\\\server\\src\\a.ts', 'src/../a.ts', 'src/%2e%2e/a.ts', 'src\\a.ts', 'src//a.ts', 'src/a.ts:stream', 'src/a.ts.', 'src/a.ts ', 'src/a\u0000.ts', '.git/config', '.env', 'src/.env.ts', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'src/node_modules/a.ts', 'src/build/a.ts', 'src/dist/a.ts', 'src/credentials.ts', 'src/config.ts', 'src/secrets/a.ts', 'src/a.js', 'src/a.png', 'src/a.d.ts'])('rejects %s', (file) => expect(allowedPatchPath(file)).toBe(false));
});
describe('authored patch evaluation', () => {
  it.each(labels)('$id', async (label) => {
    const result = await evaluatePatchCase(label, registry, proof);
    expect(result.statusCorrect, JSON.stringify(result.patch)).toBe(true);
    expect(result.schemaValid).toBe(true); expect(result.authorizedFiles).toBe(true);
    expect(result.expectedTransform).toBe(true); expect(result.originalsUnchanged).toBe(true);
    expect(result.dependencyEdits).toBe(0); expect(result.unsupportedFactInventions).toBe(0);
    if (result.supported) expect(result.syntax).toBe(true);
    if (result.malicious) expect(result.rejectedWithoutWrites).toBe(true);
  });
});
describe('workspace and model trust boundary', () => {
  it('accepts an explicitly supplied migration rule only when its digest matches the reviewed change', async () => {
    const workspace = await createPatchWorkspace(fixture);
    const change = registry.find((candidate) => candidate.id === 'stripe-subscription-coupon-removed')!;
    const planning = await proof.planningInput(workspace.directory, change);
    const changeDigest = crypto.createHash('sha256').update(JSON.stringify(change)).digest('hex');
    const rule = {
      changeDigest,
      transformation: { kind: 'singleton-discount' as const, paths: ['coupon'], destination: 'discounts', valuePolicy: 'nonempty-string-or-identifier' as const, rejectSiblings: ['discounts', 'coupon'] },
      sources: ['https://docs.stripe.com/changelog/test-migration'],
      limitations: ['Test rule is bound to this exact reviewed change digest.'],
    };

    const context = await buildPatchContext(workspace, planning, deterministicPlan(planning), { rule });
    expect(context.supported).toBe(true);
    expect(context.changeDigest).toBe(changeDigest);
    await expect(buildPatchContext(workspace, planning, deterministicPlan(planning), { rule: { ...rule, changeDigest: '0'.repeat(64) } })).rejects.toMatchObject({ code: 'STALE_TRANSFORMATION_RULE' });
  });

  it('refuses arbitrary repositories, original corpora and the tool itself', async () => {
    for (const directory of [root, path.join(root, 'evaluation-plans/corpus/coupon-direct'), await repository()]) await expect(createPatchWorkspace(directory)).rejects.toMatchObject({ code: 'FIXTURE_ONLY' });
  });
  it('refuses forged workspace handles', async () => {
    const { workspace } = await setup(); await expect(checkWorkspace({ ...workspace, directory: root })).rejects.toMatchObject({ code: 'UNISSUED_WORKSPACE' });
  });
  it('rejects forged and cross-workspace contexts and ignores caller mutations', async () => {
    const { workspace, input, patch } = await setup(); const other = await createPatchWorkspace(fixture);
    await expect(applyCandidate(other, input, patch)).rejects.toMatchObject({ code: 'UNISSUED_PATCH_CONTEXT' });
    await expect(applyCandidate(workspace, structuredClone(input), patch)).rejects.toMatchObject({ code: 'UNISSUED_PATCH_CONTEXT' });
    input.targets[0]!.replacement = 'discounts: [{ coupon: attacker }]'; patch.files[0]!.edits[0]!.replacement = input.targets[0]!.replacement;
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
    await checkWorkspace(workspace);
  });
  it('rejects stale source without overwriting the unexpected edit', async () => {
    const { workspace, input, patch } = await setup();
    const file = path.join(workspace.directory, 'src/billing.ts'); await writeFile(file, 'export const changed = true;');
    const result = await applyCandidate(workspace, input, patch);
    expect(result.status).toBe('PATCH_REJECTED'); expect(await readFile(file, 'utf8')).toBe('export const changed = true;');
  });
  it('rejects directory junctions at apply without touching their target', async ({ skip }) => {
    const { workspace, input, patch } = await setup(); const external = await repository({ 'billing.ts': 'export const outside = true;' });
    await rename(path.join(workspace.directory, 'src'), path.join(workspace.directory, 'original-src'));
    try {
      await symlink(external, path.join(workspace.directory, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error: unknown) {
      if (process.platform === 'win32' && error instanceof Error && 'code' in error && error.code === 'EPERM') {
        skip('Windows junction creation is unavailable in this runner.');
        return;
      }
      throw error;
    }
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
    expect(await readFile(path.join(external, 'billing.ts'), 'utf8')).toBe('export const outside = true;');
  });
  it('never invokes a generator for insufficient evidence', async () => {
    let calls = 0;
    const result = await runFixturePatch(path.join(root, 'evaluation-patches/corpus/wrapper'), registry.find((c) => c.id === 'stripe-subscription-coupon-removed')!, proof, { generate: async () => { calls++; throw new Error('must not run'); } });
    expect(calls).toBe(0); expect(result.patch.status).toBe('PATCH_INSUFFICIENT_EVIDENCE');
  });
  it('returns MODEL_UNAVAILABLE and sanitizes provider failures', async () => {
    const { input } = await setup(); const unavailable = await new LLMPatchGenerator().generate(input);
    expect(unavailable.status).toBe('PATCH_GENERATION_FAILED'); expect(unavailable.warnings).toContain('MODEL_UNAVAILABLE');
    const failed = await new LLMPatchGenerator({ modelId: 'test', usesAI: false, generate: async () => { throw new Error('secret_error'); } }).generate(input);
    expect(failed.status).toBe('PATCH_GENERATION_FAILED'); expect(JSON.stringify(failed)).not.toContain('secret_error');
  });
  it('reports a thrown injected generator as a structured failure', async () => {
    const result = await runFixturePatch(fixture, registry.find((c) => c.id === 'stripe-subscription-coupon-removed')!, proof, { generate: async () => { throw new Error('sensitive_error'); } });
    expect(result.patch.status).toBe('PATCH_GENERATION_FAILED'); expect(JSON.stringify(result.patch)).not.toContain('sensitive_error');
    await checkWorkspace(result.workspace);
  });
  it('gives the model bounded context without runtime workspace paths', async () => {
    const { input } = await setup(); let request: unknown;
    const generated = await new LLMPatchGenerator({ modelId: 'inspection', usesAI: false, generate: async (value) => { request = value; return new FakeStructuredPatchModel().generate(value); } }).generate(input);
    expect(generated.generatedBy.aiUsed).toBe(false);
    const text = JSON.stringify(request); expect(text.length).toBeLessThan(30_000); expect(text).not.toContain(input.workspace); expect(text).not.toContain('package-lock.json');
  });
  it('redacts common credentials and environment access', () => {
    const value = redactPatchContext("const password = 'hidden'; const apiKey = 'private'; process.env.STRIPE_KEY; const key='sk_test_NOTREAL'; const jwt='eyJabc.def.ghi';");
    expect(value.redacted).toBe(true); for (const secret of ['hidden', 'private', 'sk_test_NOTREAL', 'eyJabc.def.ghi', 'STRIPE_KEY']) expect(value.text).not.toContain(secret);
  });
  it.each(['path', 'file', 'digest', 'range', 'evidence', 'plan', 'overlap', 'semantic', 'human-review'])('rejects tampered candidate %s', async (kind) => {
    const { input, patch } = await setup(); const file = patch.files[0]!; const edit = file.edits[0]!;
    if (kind === 'path') file.path = '../../README.md';
    if (kind === 'file') file.path = 'src/auth.ts';
    if (kind === 'digest') file.originalDigest = '0'.repeat(64);
    if (kind === 'range') edit.start = 0;
    if (kind === 'evidence') edit.evidenceIds = ['invented'];
    if (kind === 'plan') patch.planReferences = ['0'.repeat(64)];
    if (kind === 'overlap') file.edits.push(structuredClone(edit));
    if (kind === 'semantic') edit.replacement = 'discounts: [{ coupon: attacker }]';
    const raw = kind === 'human-review' ? { ...patch, requiresHumanReview: false } : patch;
    expect(validateCandidate(raw, input).status).toBe('PATCH_REJECTED');
  });
  it('applies a valid candidate with real diff, digests, syntax and unchanged originals', async () => {
    const { workspace, input, patch } = await setup(); const before = await readFile(path.join(fixture, 'src/billing.ts'), 'utf8');
    const result = await applyCandidate(workspace, input, patch);
    expect(CandidatePatchSchema.safeParse(result).success).toBe(true); expect(result.status).toBe('PATCH_READY_FOR_VALIDATION');
    expect(result.files[0]!.unifiedDiff).toContain('+client.subscriptions.create({ discounts:');
    expect(result.files[0]!.patchedDigest).not.toBe(result.files[0]!.originalDigest);
    expect(await readFile(path.join(fixture, 'src/billing.ts'), 'utf8')).toBe(before);
    expect(result.validation.find((v) => v.stage === 'syntax')?.passed).toBe(true);
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
  });
  it('updates only matching Stripe test assertions alongside the migrated source call', async () => {
    const files = {
      'package.json': '{"name":"test-aware-stripe","dependencies":{"stripe":"17.7.0"}}',
      'src/services/billing.ts': "import Stripe from 'stripe';\nconst client = new Stripe('');\nexport function createSubscription(couponId: string) {\n  return client.subscriptions.create({ customer: 'cus_controlled', coupon: couponId });\n}\n",
      'tests/billing.test.ts': "import { expect, it, vi } from 'vitest';\nconst mockSubscriptionsCreate = vi.fn();\nconst mockCustomersCreate = vi.fn();\nvi.mock('stripe', () => ({ default: class { subscriptions = { create: mockSubscriptionsCreate }; customers = { create: mockCustomersCreate }; } }));\nit('matches the migrated request', () => {\n  expect(mockSubscriptionsCreate).toHaveBeenCalledWith({ customer: 'cus_controlled', coupon: 'PROMO2026' });\n  expect(mockSubscriptionsCreate).toHaveBeenLastCalledWith({ coupon: 'SPRING50' });\n  expect(mockCustomersCreate).toHaveBeenCalledWith({ coupon: 'UNRELATED' });\n  expect({ coupon: 'UNRELATED' }).toEqual({ coupon: 'UNRELATED' });\n});\n",
    };
    const workspace = await createSourcePatchWorkspace('test-aware-stripe', files);
    try {
      const changeRecord = registry.find((candidate) => candidate.id === 'stripe-subscription-coupon-removed')!;
      const planning = await proof.planningInput(workspace.directory, changeRecord);
      const context = await buildPatchContext(workspace, planning, deterministicPlan(planning));
      const patch = await applyCandidate(workspace, context, await new DeterministicPatchGenerator().generate(context));
      expect(patch.status).toBe('PATCH_READY_FOR_VALIDATION');
      expect(patch.files.map((file) => file.path)).toEqual(['src/services/billing.ts', 'tests/billing.test.ts']);
      await expect(readFile(path.join(workspace.directory, 'src/services/billing.ts'), 'utf8')).resolves.toContain('discounts: [{ coupon: couponId }]');
      const testResult = await readFile(path.join(workspace.directory, 'tests/billing.test.ts'), 'utf8');
      expect(testResult).toContain("discounts: [{ coupon: 'PROMO2026' }]");
      expect(testResult).toContain("discounts: [{ coupon: 'SPRING50' }]");
      expect(testResult).toContain("expect(mockCustomersCreate).toHaveBeenCalledWith({ coupon: 'UNRELATED' })");
      expect(testResult).toContain("expect({ coupon: 'UNRELATED' }).toEqual({ coupon: 'UNRELATED' })");
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });
  it('matches the historical Testimonal hoisted Stripe mock without authorizing unrelated spies', async () => {
    const files = {
      'package.json': '{"name":"testimonal-baseline","dependencies":{"stripe":"17.7.0"}}',
      'src/services/billing.ts': "import Stripe from 'stripe';\nconst stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_fixture');\nexport async function createSubscription(customerId: string, priceId: string, couponId: string) {\n  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], coupon: couponId } as never);\n}\n",
      'tests/billing.test.ts': "import { expect, it, vi } from 'vitest';\nconst { mockSubscriptionsCreate, mockCustomersCreate, unrelatedSpy, similarlyNamedSpy } = vi.hoisted(() => ({\n  mockSubscriptionsCreate: vi.fn(),\n  mockCustomersCreate: vi.fn(),\n  unrelatedSpy: vi.fn(),\n  similarlyNamedSpy: vi.fn(),\n}));\nvi.mock('stripe', () => ({ default: vi.fn().mockImplementation(() => ({\n  subscriptions: { create: mockSubscriptionsCreate, update: similarlyNamedSpy },\n  customers: { create: mockCustomersCreate },\n})) }));\nvi.mock('other-provider', () => ({ default: vi.fn().mockImplementation(() => ({\n  subscriptions: { create: unrelatedSpy },\n})) }));\nit('matches the migrated request', () => {\n  expect(mockSubscriptionsCreate).toHaveBeenCalledWith({ customer: 'cust_99', items: [{ price: 'price_abc' }], coupon: 'PROMO2026' });\n  expect(mockSubscriptionsCreate).toHaveBeenLastCalledWith({ coupon: 'SPRING50' });\n  expect(mockCustomersCreate).toHaveBeenCalledWith({ coupon: 'CUSTOMER_ONLY' });\n  expect(unrelatedSpy).toHaveBeenCalledWith({ coupon: 'UNRELATED_PROVIDER' });\n  expect(similarlyNamedSpy).toHaveBeenCalledWith({ coupon: 'WRONG_STRIPE_METHOD' });\n});\n",
    };
    const workspace = await createSourcePatchWorkspace('testimonal-baseline', files);
    try {
      const changeRecord = registry.find((candidate) => candidate.id === 'stripe-subscription-coupon-removed')!;
      const planning = await proof.planningInput(workspace.directory, changeRecord);
      const context = await buildPatchContext(workspace, planning, deterministicPlan(planning));
      const patch = await applyCandidate(workspace, context, await new DeterministicPatchGenerator().generate(context));
      expect(patch.status).toBe('PATCH_READY_FOR_VALIDATION');
      expect(patch.files.map((file) => file.path)).toEqual(['src/services/billing.ts', 'tests/billing.test.ts']);
      const testResult = await readFile(path.join(workspace.directory, 'tests/billing.test.ts'), 'utf8');
      expect(testResult).toContain("discounts: [{ coupon: 'PROMO2026' }]");
      expect(testResult).toContain("discounts: [{ coupon: 'SPRING50' }]");
      expect(testResult).toContain("coupon: 'CUSTOMER_ONLY'");
      expect(testResult).toContain("coupon: 'UNRELATED_PROVIDER'");
      expect(testResult).toContain("coupon: 'WRONG_STRIPE_METHOD'");
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });
  it('parses TS and TSX without running code and rejects malformed syntax', () => {
    expect(syntaxValid('src/a.ts', "throw new Error('must never run');")).toBe(true);
    expect(syntaxValid('src/a.tsx', 'const view = <div />;')).toBe(true);
    expect(syntaxValid('src/a.ts', 'const x = [{;')).toBe(false);
  });
  it('generates an evidence-bound Twilio namespace edit without touching unrelated receivers', async () => {
    const twilioRegistry = await loadTwilioRegistry(path.join(root, 'registry/twilio'));
    const change = twilioRegistry.find((candidate) => candidate.id === 'twilio-twiml-namespace-casing')!;
    const source = "import twilio from 'twilio';\nconst response = twilio.Twiml.VoiceResponse({});\nconst unrelated = other.Twiml.VoiceResponse({});\n";
    const input = {
      change,
      impacts: [{ usageId: 'usage-twiml', changeId: change.id, symbol: 'Twiml.VoiceResponse', location: { file: 'src/voice.ts', start: { line: 2, column: 1 }, end: { line: 2, column: 45 } }, reason: 'Legacy Twiml namespace', confidence: 0.98, versionAssessment: 'in-range', reasonCodes: ['AFFECTED_METHOD_USED'] }],
    } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/voice.ts', source, input, 'a'.repeat(64), {
      kind: 'qualified-member-rename', from: 'Twiml', to: 'twiml', receiver: 'twilio', preserveArguments: true,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: 'Twiml', replacement: 'twiml', evidenceIds: ['impact:usage-twiml', `change:${change.id}`] });
    expect(source.slice(targets[0]!.start, targets[0]!.end)).toBe('Twiml');
  });
  it('generates an evidence-bound OpenAI model literal edit without touching dynamic models', () => {
    const change = { id: 'openai-gpt-4-5-preview-removal-2025-07-14', rules: [] };
    const source = "client.chat.completions.create({ model: 'gpt-4.5-preview', input });\nclient.chat.completions.create({ model: selectedModel, input });\n";
    const input = {
      change,
      impacts: [{ usageId: 'usage-openai-model', changeId: change.id, symbol: 'gpt-4.5-preview', location: { file: 'src/ai.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 72 } }, reason: 'Retired model', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }],
    } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/ai.ts', source, input, 'a'.repeat(64), {
      kind: 'model-literal-rename', property: 'model', from: 'gpt-4.5-preview', to: 'gpt-4.1', preserveArguments: true,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: "'gpt-4.5-preview'", replacement: "'gpt-4.1'", evidenceIds: ['impact:usage-openai-model', `change:${change.id}`] });
  });

  it('generates an evidence-bound Groq model literal edit without touching dynamic models', () => {
    const change = { id: 'groq-qwen-3-6-27b-retired-2026-09-14', rules: [] };
    const source = "client.chat.completions.create({ model: 'qwen/qwen3.6-27b', input });\nclient.chat.completions.create({ model: selectedModel, input });\n";
    const input = { change, impacts: [{ usageId: 'usage-groq-model', changeId: change.id, symbol: 'qwen/qwen3.6-27b', location: { file: 'src/ai.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 78 } }, reason: 'Retired Groq model', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/ai.ts', source, input, 'a'.repeat(64), { kind: 'model-literal-rename', property: 'model', from: 'qwen/qwen3.6-27b', to: 'qwen/qwen3.8-27b', preserveArguments: true });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: "'qwen/qwen3.6-27b'", replacement: "'qwen/qwen3.8-27b'" });
  });

  it('generates an evidence-bound Shopify apiVersion literal edit without touching dynamic versions', () => {
    const change = { id: 'shopify-api-2025-10-version-retired-2026-10-16', rules: [] };
    const source = "client.request({ apiVersion: '2025-10', query });\nclient.request({ apiVersion: selectedVersion, query });\n";
    const input = { change, impacts: [{ usageId: 'usage-shopify-version', changeId: change.id, symbol: '2025-10', location: { file: 'src/shopify.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 58 } }, reason: 'Retired Shopify API version', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/shopify.ts', source, input, 'a'.repeat(64), { kind: 'api-version-literal-rename', property: 'apiVersion', from: '2025-10', to: '2026-01', preserveArguments: true });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: "'2025-10'", replacement: "'2026-01'" });
  });
  it('generates an evidence-bound Firebase import alias edit without touching unrelated strings', () => {
    const change = { id: 'firebase-vertexai-import-alias-removed-2025-07-17', rules: [] };
    const source = "import { getVertexAI } from 'firebase/vertexai';\nconst label = 'firebase/vertexai';\n";
    const input = { change, impacts: [{ usageId: 'usage-firebase-import', changeId: change.id, symbol: 'firebase/vertexai', location: { file: 'src/firebase.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 48 } }, reason: 'Removed Firebase import alias', confidence: 0.99, versionAssessment: 'in-range', reasonCodes: ['MATCHED_STATIC_USAGE'] }] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/firebase.ts', source, input, 'a'.repeat(64), { kind: 'import-specifier-rename', from: 'firebase/vertexai', to: 'firebase/ai', preserveBindings: true });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: "'firebase/vertexai'", replacement: "'firebase/ai'" });
  });

  it('generates evidence-bound Firebase identifier edits without renaming unrelated identifiers', () => {
    const change = { id: 'firebase-vertexai-symbols-removed-2025-07-17', rules: [] };
    const source = "const model = getVertexAI(app);\nconst error = new VertexAIError('bad');\nconst unrelated = getVertexAIFromConfig();\n";
    const input = { change, impacts: [
      { usageId: 'usage-firebase-get', changeId: change.id, symbol: 'getVertexAI', location: { file: 'src/firebase.ts', start: { line: 1, column: 15 }, end: { line: 1, column: 26 } }, reason: 'Removed Firebase symbol', confidence: 0.99, versionAssessment: 'in-range', reasonCodes: ['MATCHED_STATIC_USAGE'] },
      { usageId: 'usage-firebase-error', changeId: change.id, symbol: 'VertexAIError', location: { file: 'src/firebase.ts', start: { line: 2, column: 21 }, end: { line: 2, column: 34 } }, reason: 'Removed Firebase symbol', confidence: 0.99, versionAssessment: 'in-range', reasonCodes: ['MATCHED_STATIC_USAGE'] },
    ] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/firebase.ts', source, input, 'a'.repeat(64), {
      kind: 'identifier-rename-many',
      replacements: [{ from: 'getVertexAI', to: 'getAI' }, { from: 'VertexAIError', to: 'AIError' }],
      preserveBindings: true,
    });
    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.replacement)).toEqual(['getAI', 'AIError']);
    expect(targets.map((target) => target.expected)).toEqual(['getVertexAI', 'VertexAIError']);
  });

  it('generates an evidence-bound Clerk JSX attribute rename without changing the value', () => {
    const change = { id: 'clerk-core-3-after-switch-organization-url-removed', rules: [] };
    const source = '<OrganizationSwitcher afterSwitchOrganizationUrl={onSwitch} afterSelectOrganizationUrl={other} />';
    const input = { change, impacts: [{ usageId: 'usage-clerk-prop', changeId: change.id, symbol: 'afterSwitchOrganizationUrl', location: { file: 'src/organizations.tsx', start: { line: 1, column: 23 }, end: { line: 1, column: 51 } }, reason: 'Removed Clerk prop', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/organizations.tsx', source, input, 'a'.repeat(64), { kind: 'jsx-attribute-rename', from: 'afterSwitchOrganizationUrl', to: 'afterSelectOrganizationUrl', preserveValue: true });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: 'afterSwitchOrganizationUrl', replacement: 'afterSelectOrganizationUrl' });
  });

  it('generates an evidence-bound Twilio domain edit inside a direct URL literal', () => {
    const change = { id: 'twilio-regional-api-domain-removal-2026-04-28', rules: [] };
    const source = "fetch('https://api.ie1.twilio.com/2010-04-01/Accounts');\nfetch(buildTwilioUrl());\n";
    const input = {
      change,
      impacts: [{ usageId: 'usage-twilio-domain', changeId: change.id, symbol: 'api.ie1.twilio.com', location: { file: 'src/twilio.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 62 } }, reason: 'Retired regional domain', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }],
    } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/twilio.ts', source, input, 'a'.repeat(64), {
      kind: 'string-literal-rename', from: 'api.ie1.twilio.com', to: 'api.twilio.com', preserveArguments: true,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ expected: "'https://api.ie1.twilio.com/2010-04-01/Accounts'", replacement: "'https://api.twilio.com/2010-04-01/Accounts'", evidenceIds: ['impact:usage-twilio-domain', `change:${change.id}`] });
  });
  it('covers every reviewed Twilio regional domain while refusing dynamic URL construction', () => {
    const change = { id: 'twilio-regional-api-domain-removal-2026-04-28', rules: [] };
    const source = "fetch('https://api.au1.twilio.com/2010-04-01/Accounts');\nfetch('https://api.us2.twilio.com/2010-04-01/Accounts');\nfetch(buildTwilioUrl());\n";
    const input = { change, impacts: [
      { usageId: 'usage-au', changeId: change.id, symbol: 'api.au1.twilio.com', location: { file: 'src/twilio.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 62 } }, reason: 'Retired regional domain', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] },
      { usageId: 'usage-us', changeId: change.id, symbol: 'api.us2.twilio.com', location: { file: 'src/twilio.ts', start: { line: 2, column: 1 }, end: { line: 2, column: 62 } }, reason: 'Retired regional domain', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] },
    ] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/twilio.ts', source, input, 'a'.repeat(64), { kind: 'string-literal-rename-many', replacements: [
      { from: 'api.ie1.twilio.com', to: 'api.twilio.com' }, { from: 'api.au1.twilio.com', to: 'api.twilio.com' }, { from: 'api.br1.twilio.com', to: 'api.twilio.com' }, { from: 'api.de1.twilio.com', to: 'api.twilio.com' }, { from: 'api.jp1.twilio.com', to: 'api.twilio.com' }, { from: 'api.sg1.twilio.com', to: 'api.twilio.com' }, { from: 'api.us2.twilio.com', to: 'api.twilio.com' },
    ], preserveArguments: true });
    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.replacement)).toEqual(["'https://api.twilio.com/2010-04-01/Accounts'", "'https://api.twilio.com/2010-04-01/Accounts'"]);
  });
  it.each([
    ['/Engagements', '/Executions'],
    ['analytics/endpoints/logs.all', 'analytics/endpoints/logs'],
    ['/{owner}/{repo}/dependency-graph/sbom', '/{owner}/{repo}/dependency-graph/sbom/generate-report'],
    ['/v1/dubbing', '/v1/dubbing/project'],
    ['/api/mail.send.json', '/v3/mail/send'],
  ])('supports a bounded endpoint literal replacement from %s to %s', (from, to) => {
    const change = { id: `change-${from}`, rules: [] };
    const source = `request('/v1${from}');\nrequest(buildDynamicPath());\n`;
    const input = { change, impacts: [{ usageId: 'usage-endpoint', changeId: change.id, symbol: from, location: { file: 'src/client.ts', start: { line: 1, column: 1 }, end: { line: 1, column: 80 } }, reason: 'Deprecated endpoint', confidence: 0.99, versionAssessment: 'not-constrained', reasonCodes: ['MATCHED_STATIC_USAGE'] }] } as unknown as Parameters<typeof targetsFor>[2];
    const targets = targetsFor('src/client.ts', source, input, 'a'.repeat(64), { kind: 'string-literal-rename', from, to, preserveArguments: true });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.replacement).toContain(to);
  });
  it('emits standard diff markers including missing terminal newline', () => {
    expect(unifiedDiff('src/a.ts', 'const a = 1;', 'const a = 2;')).toContain('\\ No newline at end of file');
    expect(unifiedDiff('src/a.ts', 'same\n', 'same\n')).toBe('');
    expect(unifiedDiff('src/a.ts', "const password = 'hidden';\nconst a = 1;\n", "const password = 'hidden';\nconst a = 2;\n")).not.toContain('hidden');
  });
  it('keeps distant edits in separate hunks without rewriting the intervening source', () => {
    const before = 'const a = 1;\n' + '// unchanged\n'.repeat(100) + 'const b = 1;\n';
    const offsets = [before.indexOf('1'), before.lastIndexOf('1')];
    const edits = offsets.map((start, i) => ({ targetId: `t${i}`, operation: 'replace-range' as const, start, end: start + 1, expected: '1', replacement: '2', evidenceIds: ['e'] }));
    const after = before.replaceAll('= 1', '= 2'); const diff = editDiff('src/a.ts', before, after, edits);
    expect(diff.match(/^@@ /gm)).toHaveLength(2); expect(diff).not.toContain('-// unchanged'); expect(diff.length).toBeLessThan(400);
  });
});
