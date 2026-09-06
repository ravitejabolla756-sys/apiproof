import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStripeRegistry } from '@apiproof/providers';
import { CorpusSchema } from '@apiproof/shared';
import { readFile } from 'node:fs/promises';
import { proof, repository, root } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
const prefix = "import Stripe from 'stripe';\nconst client = new Stripe(process.env.KEY!);\n";
async function impact(source: string, id = 'invoice-upcoming-removed', extra: Record<string, string> = {}) {
  const directory = await repository({ 'package.json': '{"dependencies":{"stripe":"17.7.0"}}', 'src.ts': prefix + source, ...extra });
  return proof.impact(directory, registry.find((item) => item.id === `stripe-${id}`));
}

describe('member expression semantics', () => {
  it.each([
    'if (client.invoices?.retrieveUpcoming) {}',
    "typeof client.invoices.retrieveUpcoming === 'function';",
    '!!client.invoices.retrieveUpcoming;',
    'client.invoices.retrieveUpcoming == null;',
    'client.invoices.retrieveUpcoming && reportAvailable();',
    'Boolean(client.invoices.retrieveUpcoming);',
    'if (client.invoices.retrieveUpcoming || otherAvailable) {}',
  ])('records a capability probe without claiming behavior: %s', async (source) => {
    const result = await impact(source);
    expect(result.impacts).toHaveLength(0);
    expect(result.scan.usages.find((item) => item.symbol === 'invoices.retrieveUpcoming')?.semantics).toBe('capability-check');
  });
  it.each([
    ['client.invoices.retrieveUpcoming({});', 'invocation'],
    ['client.invoices?.retrieveUpcoming({});', 'optional-invocation'],
    ['client.invoices.retrieveUpcoming?.({});', 'optional-invocation'],
    ['const method = client.invoices.retrieveUpcoming;', 'method-reference'],
  ])('keeps an affected invocation or reference: %s', async (source, semantics) => {
    const result = await impact(source!);
    expect(result.impacts).toHaveLength(1);
    expect(result.scan.usages.find((item) => item.symbol === 'invoices.retrieveUpcoming')?.semantics).toBe(semantics);
    expect(result.impacts[0]?.evidence[0]?.kind).toBe(semantics === 'method-reference' ? 'method-reference' : 'method-call');
  });
  it('allows an explicitly reviewed rule to care about capability probes', async () => {
    const directory = await repository({ 'src.ts': prefix + 'if (client.invoices.retrieveUpcoming) {}' });
    const original = registry.find((item) => item.id === 'stripe-invoice-upcoming-removed')!;
    const result = await proof.impact(directory, { ...original, affectedSdkVersions: undefined,
      rules: [{ kind: 'method', symbol: 'invoices.retrieveUpcoming', match: 'exact', includeCapabilityChecks: true }] });
    expect(result.impacts[0]?.evidence[0]?.kind).toBe('capability-check');
  });
});

describe('bounded parameter builders', () => {
  it.each([
    "function build() { return { coupon: 'private_value' }; }",
    "const build = () => ({ coupon: 'private_value' });",
    "function build() { const p = { coupon: 'private_value' }; const alias = p; return alias; }",
    "function inner() { return { coupon: 'private_value' }; } function build() { return inner(); }",
  ])('propagates explicit property evidence and helper locations: %s', async (builder) => {
    const result = await impact(builder + "\nclient.subscriptions.create(build());", 'subscription-coupon-removed');
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.evidence).toContainEqual(expect.objectContaining({ kind: 'parameter-builder', name: 'build', callSite: expect.any(Object), location: expect.any(Object) }));
    expect(result.scan.usages.find((item) => item.symbol === 'subscriptions.create')?.confidence).toBe(0.9);
    expect(JSON.stringify(result)).not.toContain('private_value');
  });
  it.each([
    "function build() { return build(); }",
    "function build() { if (unknown) return { coupon: 'old' }; return {}; }",
    "async function build() { return { coupon: 'old' }; }",
    "const build = function* () { return { coupon: 'old' }; };",
    "function build() { const p = { coupon: 'old' }; delete p.coupon; return p; }",
    "function build() { const p = { coupon: 'old' }; p.coupon = unknown; return p; }",
    "const build = externalFactory;",
  ])('keeps unresolved or unsafe builder shapes inconclusive: %s', async (builder) => {
    const result = await impact(builder + '\nclient.subscriptions.create(build());', 'subscription-coupon-removed');
    expect(result.impacts).toHaveLength(0);
    expect(result.status).toBe('inconclusive');
  });
  it('does not connect a helper that never supplies a provider argument', async () => {
    const result = await impact("const build = () => ({ coupon: 'old' }); client.subscriptions.create({ discounts: [] });", 'subscription-coupon-removed');
    expect(result.impacts).toHaveLength(0);
  });
});

describe('Promise fulfillment provenance', () => {
  it.each([
    "client.subscriptions.retrieve('id').then(s => s.current_period_end);",
    "client.subscriptions.retrieve('id').then(s => { return s.current_period_end; });",
    "const p = client.subscriptions.retrieve('id'); const alias = p; alias.then(s => s.current_period_end);",
    "client.subscriptions.retrieve('id').then(({ current_period_end }) => current_period_end);",
  ])('associates only a proven fulfillment parameter: %s', async (source) => {
    const result = await impact(source, 'subscription-period-fields');
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.evidence).toContainEqual(expect.objectContaining({ kind: 'promise-callback' }));
  });
  it.each([
    "Promise.resolve({ current_period_end: 0 }).then(s => s.current_period_end);",
    "client.subscriptionItems.retrieve('id').then(s => s.current_period_end);",
    "client.subscriptions.retrieve('id').then(undefined, error => error.current_period_end);",
    "client.subscriptions.retrieve('id').then(s => ({ current_period_end: 0 })).then(s => s.current_period_end);",
    "const p = client.subscriptions.retrieve('id'); p.current_period_end;",
  ])('rejects lookalikes, rejection callbacks and transformed chains: %s', async (source) => {
    expect((await impact(source, 'subscription-period-fields')).impacts).toHaveLength(0);
  });
  it('explains unknown callback provenance', async () => {
    const result = await impact('getSubscription().then(s => s.current_period_end);', 'subscription-period-fields');
    expect(result.status).toBe('inconclusive');
    expect(result.scan.diagnostics.map((item) => item.code)).toContain('UNRESOLVED_PROMISE_CALLBACK');
  });
  it('reports response objects escaping through unmodeled wrappers', async () => {
    const result = await impact("async function f() { const wrapped = wrap(await client.subscriptions.retrieve('id')); return wrapped.current_period_end; }", 'subscription-period-fields');
    expect(result.status).toBe('inconclusive');
    expect(result.scan.diagnostics.map((item) => item.code)).toContain('UNRESOLVED_RESPONSE_FLOW');
  });
});

describe('deterministic computed names', () => {
  it.each([
    "client.invoices['retrieveUpcoming']({});",
    "const name = 'retrieveUpcoming'; client.invoices[name]({});",
    "const original = 'retrieveUpcoming' as const; const alias = original; client.invoices[alias]({});",
  ])('resolves only immutable string evidence: %s', async (source) => {
    expect((await impact(source)).impacts).toHaveLength(1);
  });
  it.each([
    'function f(name: string) { client.invoices[name]({}); }',
    'client.invoices[getName()]({});',
    "const name = unknown ? 'retrieveUpcoming' : 'createPreview'; client.invoices[name]({});",
    "let name = 'retrieveUpcoming'; name = 'createPreview'; client.invoices[name]({});",
    "const a = b; const b = a; client.invoices[a]({});",
  ])('does not guess dynamic names: %s', async (source) => {
    const result = await impact(source);
    expect(result.impacts).toHaveLength(0);
    expect(result.status).toBe('inconclusive');
    expect(result.scan.diagnostics.map((item) => item.code)).toContain('DYNAMIC_MEMBER');
  });
});

describe('label provenance', () => {
  it('requires case attribution and rejects invented independent agent review', async () => {
    const corpus = CorpusSchema.parse(JSON.parse(await readFile(path.join(root, 'evaluation/labels/cases.json'), 'utf8')));
    expect(corpus.cases.every((item) => item.provenance.reviewStatus === 'authored' && item.provenance.authoredBy.kind === 'agent')).toBe(true);
    const first = corpus.cases[0]!;
    expect(CorpusSchema.safeParse({ ...corpus, cases: [{ ...first, provenance: undefined }] }).success).toBe(false);
    expect(CorpusSchema.safeParse({ ...corpus, cases: [{ ...first, provenance: { ...first.provenance, reviewStatus: 'independently-reviewed', reviewedBy: { name: 'Another agent', kind: 'agent' } } }] }).success).toBe(false);
  });
});
