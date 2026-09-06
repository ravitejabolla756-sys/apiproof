import { describe, expect, it } from 'vitest';
import { ApiChangeSchema, ImpactResultSchema } from '@apiproof/shared';
import { change, fixture, proof, provider, repository } from './helpers.js';

describe('deterministic impact matching', () => {
  it.each([['affected', 1], ['unaffected', 0], ['no-stripe', 0], ['multiple', 3]] as const)(
    '%s has %i impacts', async (name, count) => {
      const result = await proof.impact(fixture(name), change);
      expect(ImpactResultSchema.safeParse(result).success).toBe(true);
      expect(result.impacts).toHaveLength(count);
      expect(result.status).toBe(count ? 'potentially-affected' : 'no-matched-usage');
      expect(result.verification.status).toBe('not-run');
      for (const impact of result.impacts) {
        expect(result.scan.usages.some((usage) => usage.id === impact.usageId)).toBe(true);
        expect(impact.reason).toContain('customers.retrieve');
        expect(impact.reason).toContain('16.12.0');
        expect(impact.confidence).toBeGreaterThan(0);
      }
    },
  );

  it('uses conservative confidence when only a declared range is known', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe'; const s = new Stripe(''); s.customers.retrieve('');` });
    const result = await proof.impact(directory, change);
    expect(result.impacts[0]).toMatchObject({ versionAssessment: 'unknown', confidence: 0.7 });
  });

  it('filters exact known SDK versions outside the affected range', async () => {
    const result = await proof.impact(fixture('affected'), { ...provider.validateChange(change), affectedSdkVersions: '>=17' });
    expect(result.impacts).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toContain('SDK_OUTSIDE_RANGE');
  });

  it('matches resource prefixes by path segment without matching lookalike prefixes', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe'; const s = new Stripe(''); s.customers.retrieve(''); s.customersArchive.retrieve('');` });
    const result = await proof.impact(directory, { ...provider.validateChange(change),
      affectedSymbols: [{ symbol: 'customers', match: 'prefix', kind: 'method' }] });
    expect(result.impacts.map((impact) => impact.symbol)).toEqual(['customers.retrieve']);
  });

  it('matches only the requested usage kind', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe'; export type Payment = Stripe.PaymentIntent; const s = new Stripe(''); s.PaymentIntent();` });
    const result = await proof.impact(directory, { ...provider.validateChange(change),
      affectedSymbols: [{ symbol: 'PaymentIntent', match: 'exact', kind: 'type' }] });
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.matchedRule).toBe('type:exact:PaymentIntent');
  });

  it('makes API-version uncertainty explicit', async () => {
    const result = await proof.impact(fixture('affected'), { ...provider.validateChange(change), apiVersion: '2099-01-01' });
    expect(result.impacts[0]?.confidence).toBe(0.7);
    expect(result.diagnostics.map((item) => item.code)).toContain('API_VERSION_UNVERIFIED');
  });

  it('uses the originating client workspace version for cross-workspace imports', async () => {
    const directory = await repository({
      'package.json': '{"private":true}',
      'apps/web/package.json': '{"dependencies":{"stripe":"18.0.0"}}',
      'packages/billing/package.json': '{"dependencies":{"stripe":"16.12.0"}}',
      'packages/billing/client.ts': `import Stripe from 'stripe'; export const client = new Stripe('');`,
      'apps/web/index.ts': `import { client } from '../../packages/billing/client.js'; client.customers.retrieve('');`,
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\nimporters:\n  apps/web:\n    dependencies:\n      stripe:\n        version: 18.0.0\n  packages/billing:\n    dependencies:\n      stripe:\n        version: 16.12.0\n`,
    });
    const result = await proof.impact(directory, change);
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0]?.reason).toContain('16.12.0');
  });

  it('reports inconclusive when unsupported code prevents a no-match assurance', async () => {
    const directory = await repository({ 'src.ts': `const stripe = await import('stripe');` });
    expect((await proof.impact(directory, change)).status).toBe('inconclusive');
  });

  it.each([
    { provider: 'openai' }, { affectedSdkVersions: 'yesterday' }, { targetSdkVersion: '^17' },
    { sourceUrl: 'file:///etc/passwd' }, { severity: 'extreme' }, { extra: true },
    { affectedSymbols: [] }, { provenance: 'official' },
  ])('rejects invalid changes: %j', (replacement) => {
    expect(() => provider.validateChange({ ...provider.validateChange(change), ...replacement })).toThrow();
  });

  it('accepts evidence URLs without fetching them and validates dates', () => {
    const official = { ...provider.validateChange(change), provenance: 'official', sourceUrl: 'https://example.invalid/evidence', effectiveDate: '2026-09-06' };
    expect(ApiChangeSchema.safeParse(official).success).toBe(true);
    expect(ApiChangeSchema.safeParse({ ...official, effectiveDate: '2026-19-60' }).success).toBe(false);
  });
});
