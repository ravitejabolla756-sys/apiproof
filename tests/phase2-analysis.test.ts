import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadStripeRegistry, validateRegistryChange } from '@apiproof/providers';
import { proof, repository, root } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
function record(id: string) {
  const change = registry.find((item) => item.id === `stripe-${id}`);
  if (!change) throw new Error('Missing test registry record');
  return change;
}
const prefix = `import Stripe from 'stripe';\nconst client = new Stripe(process.env.STRIPE_SECRET_KEY!);\n`;
const billing = (source: string, version = '17.7.0') => repository({
  'package.json': JSON.stringify({ dependencies: { stripe: version } }), 'src.ts': prefix + source,
});

describe('reviewed change registry', () => {
  it('loads nine individually sourced records with explicit review attribution', () => {
    expect(registry).toHaveLength(9);
    for (const item of registry) {
      expect(validateRegistryChange(item).review).toMatchObject({ status: 'reviewed', reviewerKind: 'agent' });
      expect(item.evidenceSources.length).toBeGreaterThan(0);
    }
  });
  it.each(['draft', 'missing', 'unofficial-url', 'wrong-category', 'invalid-range', 'agent-verified'])(
    'rejects unsafe registry input: %s', (variant) => {
      const input = structuredClone(record('subscription-coupon-removed'));
      const changed: unknown = variant === 'draft' ? { ...input, review: { ...input.review, status: 'draft' } }
        : variant === 'missing' ? { ...input, evidenceSources: [] }
          : variant === 'unofficial-url' ? { ...input, sourceUrl: 'https://docs.stripe.com.attacker.invalid/a', evidenceSources: [{ ...input.evidenceSources[0], url: 'https://docs.stripe.com.attacker.invalid/a' }] }
            : variant === 'wrong-category' ? { ...input, changeType: 'type-changed' }
              : variant === 'invalid-range' ? { ...input, affectedSdkVersions: 'not-semver' }
                : { ...input, review: { ...input.review, status: 'verified' } };
      expect(() => validateRegistryChange(changed)).toThrow();
    },
  );
  it('accepts verified records only with explicit human verification attribution', () => {
    const input = record('subscription-coupon-removed');
    expect(validateRegistryChange({ ...input, review: { ...input.review, status: 'verified', reviewerKind: 'human', reviewer: 'Test reviewer' } }).review.status).toBe('verified');
  });
  it('rejects official Phase 1 records without review metadata', async () => {
    const input = record('subscription-coupon-removed');
    const { review: _review, ...unreviewed } = input;
    expect(_review).toBeDefined();
    await expect(proof.impact(await billing(''), unreviewed)).rejects.toMatchObject({ code: 'INVALID_REGISTRY_CHANGE' });
  });
});

describe('parameter facts and interpretation', () => {
  it('matches aliases, literal-key properties and known object spreads with parameter locations', async () => {
    const directory = await billing(`const base = { 'coupon': 'test_coupon' };\nconst api = client;\napi.subscriptions.create({ ...base, customer: 'test_customer' });`);
    const result = await proof.impact(directory, record('subscription-coupon-removed'));
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.evidence).toContainEqual(expect.objectContaining({ kind: 'parameter', name: 'coupon', location: expect.objectContaining({ start: { line: 3, column: 16 } }) }));
    expect(result.impacts[0]?.reasonCodes).toEqual(expect.arrayContaining(['AFFECTED_PARAMETER_PRESENT', 'VERSION_IN_AFFECTED_RANGE']));
    expect(JSON.stringify(result)).not.toContain('test_coupon');
    expect(JSON.stringify(result)).not.toContain('test_customer');
  });
  it('uses the correct argument index on update', async () => {
    const directory = await billing(`client.subscriptions.update('sub_test', { coupon: 'launch' });`);
    expect((await proof.impact(directory, record('subscription-coupon-removed'))).impacts).toHaveLength(1);
  });
  it.each([
    `client.subscriptions.create({ customer: 'test', metadata: { coupon: 'test' } });`,
    `client.subscriptions.create({ customer: 'test', discounts: [{ coupon: 'test' }] });`,
    `client.customers.create({ coupon: 'test' });`,
    `function f(client: { subscriptions: { create(input: unknown): void } }) { client.subscriptions.create({ coupon: 'test' }); }`,
  ])('rejects false positives: %s', async (source) => {
    expect((await proof.impact(await billing(source), record('subscription-coupon-removed'))).impacts).toHaveLength(0);
  });
  it('requires literal evidence for changed enum values', async () => {
    const source = `client.accountLinks.create({ type: 'custom_account_update' });\nclient.accountLinks.create({ type: 'account_update' });`;
    const result = await proof.impact(await billing(source, '12.18.0'), record('account-link-type-changed'));
    expect(result.impacts).toHaveLength(1);
  });
  it('reports incomplete static evidence for dynamic parameter builders', async () => {
    const directory = await billing(`const params = buildParams();\nclient.subscriptions.create(params);`);
    const result = await proof.impact(directory, record('subscription-coupon-removed'));
    expect(result.status).toBe('inconclusive');
    expect(result.diagnostics.map((item) => item.reasonCode)).toContain('INSUFFICIENT_STATIC_EVIDENCE');
  });
  it('does not trust mutated const parameter objects', async () => {
    const directory = await billing(`const params = { coupon: 'old' };\nparams.coupon = otherValue;\nclient.subscriptions.create(params);`);
    const result = await proof.impact(directory, record('subscription-coupon-removed'));
    expect(result.impacts).toHaveLength(0);
    expect(result.status).toBe('inconclusive');
  });
});

describe('response and class bindings', () => {
  it('recognizes constructor-initialized class clients', async () => {
    const directory = await billing(`class BillingService {\nprivate stripe: Stripe;\nconstructor() { this.stripe = new Stripe(process.env.KEY!); }\npreview() { return this.stripe.invoices.retrieveUpcoming({ customer: 'test' }); }\n}`);
    const result = await proof.impact(directory, record('invoice-upcoming-removed'));
    expect(result.impacts).toHaveLength(1);
    expect(result.scan.diagnostics.map((item) => item.code)).not.toContain('MUTATED_BINDING');
  });
  it('matches direct awaited responses, const aliases and destructured fields', async () => {
    const directory = await billing(`async function f() {\nconst subscription = await client.subscriptions.retrieve('test');\nconst alias = subscription;\nconst { current_period_start } = alias;\nreturn alias.current_period_end + current_period_start;\n}`);
    const result = await proof.impact(directory, record('subscription-period-fields'));
    expect(result.impacts.map((item) => item.symbol)).toEqual(['current_period_start', 'current_period_end']);
    expect(result.impacts[0]?.reasonCodes).toContain('AFFECTED_RESPONSE_FIELD_REFERENCED');
  });
  it('matches typed Subscription fields but not local lookalikes or SubscriptionItem fields', async () => {
    const directory = await billing(`function f(a: Stripe.Subscription, b: Stripe.SubscriptionItem, c: {current_period_end: number}) {\nreturn a.current_period_end + b.current_period_end + c.current_period_end;\n}`);
    expect((await proof.impact(directory, record('subscription-period-fields'))).impacts).toHaveLength(1);
  });
  it('does not confuse a Promise itself with its eventual response', async () => {
    const directory = await billing(`const subscription = client.subscriptions.retrieve('test');\nsubscription.current_period_end;`);
    expect((await proof.impact(directory, record('subscription-period-fields'))).impacts).toHaveLength(0);
  });
  it('matches an imported Stripe type alias without matching constructor usage', async () => {
    const directory = await billing(`import type { StripeContext as Context } from 'stripe';\nfunction f(context: Context) { return context; }\nnew Stripe.StripeContext();`, '21.0.0');
    const result = await proof.impact(directory, record('context-type-renamed'));
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.reasonCodes).toContain('AFFECTED_TYPE_REFERENCED');
  });
  it('finds multiple independently bound clients in one file', async () => {
    const directory = await billing(`const second = new Stripe(process.env.OTHER_KEY!);\nclient.invoices.retrieveUpcoming({});\nsecond.invoices.retrieveUpcoming({});`);
    expect((await proof.impact(directory, record('invoice-upcoming-removed'))).impacts).toHaveLength(2);
  });
  it('reports deprecation reason codes separately from matching evidence', async () => {
    const result = await proof.impact(await billing(`client.subscriptions.del('test');`, '12.18.0'), record('subscriptions-del-deprecated'));
    expect(result.impacts[0]?.reasonCodes).toContain('DEPRECATED_SYMBOL_USED');
  });
});

describe('version provenance', () => {
  it('uses exact manifest versions without pretending they are installed', async () => {
    const result = await proof.impact(await billing(`client.invoices.retrieveUpcoming({});`), record('invoice-upcoming-removed'));
    expect(result.scan.dependencies[0]).toMatchObject({ installedVersion: null, lockedVersion: null,
      versionResolution: { version: '17.7.0', source: 'declared-exact', certainty: 'declared' } });
    expect(result.impacts[0]?.reasonCodes).toContain('DECLARED_VERSION_ONLY');
  });
  it('retains version uncertainty for ranges', async () => {
    const result = await proof.impact(await billing(`client.invoices.retrieveUpcoming({});`, '^17'), record('invoice-upcoming-removed'));
    expect(result.impacts[0]?.reasonCodes).toContain('VERSION_UNKNOWN');
  });
  it('explains out-of-scope SDK versions', async () => {
    const result = await proof.impact(await billing(`client.invoices.retrieveUpcoming({});`, '18.0.0'), record('invoice-upcoming-removed'));
    expect(result.impacts).toHaveLength(0);
    expect(result.diagnostics.map((item) => item.reasonCode)).toContain('VERSION_OUTSIDE_AFFECTED_RANGE');
  });
});
