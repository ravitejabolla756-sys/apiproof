import { describe, expect, it } from 'vitest';
import {
  DEDICATED_TIER_3_PROVIDERS,
  DEDICATED_TIER_2_PROVIDERS,
  parseDedicatedProviderChangelog,
  parseDedicatedTier2ProviderChangelog,
  parseAwsChangelog,
  parseFirebaseChangelog,
  parseGitHubChangelog,
  parseOpenAiChangelog,
  parseStripeChangelog,
  parseTier1ProviderChangelog,
  parseTwilioChangelog,
  TIER_1_PROVIDERS,
} from '../apps/web/src/lib/server/provider-changelog-adapters.js';
import { parseProviderChangelogBody, PROVIDER_CHANGE_SOURCES } from '../apps/web/src/lib/server/provider-change-monitor.js';

const fixtures = {
  stripe: `
    <article>
      <h2>2027-03-01 API version retirement</h2>
      <p>In API version 2024-10-01, the <code>/v1/coupons</code> endpoint is removed.</p>
      <p>Use <code>/v1/promotion_codes</code> instead.</p>
    </article>
  `,
  twilio: `
    <li><time>April 12, 2027</time> Messaging API deprecation: the <code>/2010-04-01/Messages</code> route is removed. Migrate to <code>/v2/Messages</code>.</li>
  `,
  firebase: `
    <article><h3>2027-05-20</h3><p>Firebase JS SDK deprecation: <code>firebase.database()</code> is no longer supported. Use <code>firebase.firestore()</code>.</p></article>
  `,
  github: `
    <tr><td>2027-06-30</td><td>REST API version 2022-11-28 will be retired for <code>/repos/{owner}/{repo}/releases</code>.</td></tr>
  `,
  aws: `
    <article><p>2027-07-31</p><p>AWS SDK for JavaScript v2 reaches end-of-support. Migrate to <code>@aws-sdk/client-s3</code>.</p></article>
  `,
  openai: `
    <table><tr><th>Model</th><th>Shutdown date</th><th>Recommended replacement</th></tr>
      <tr><td><code>old-model</code></td><td>2027-08-15</td><td><code>new-model</code></td></tr>
    </table>
  `,
} as const;

describe('provider changelog adapters', () => {
  it('covers the six Tier 1 providers through one deterministic dispatcher', () => {
    expect(TIER_1_PROVIDERS).toEqual(['stripe', 'twilio', 'firebase', 'github', 'aws', 'openai']);
    for (const provider of TIER_1_PROVIDERS) {
      const result = parseTier1ProviderChangelog(provider, fixtures[provider]);
      expect(result.provider).toBe(provider);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]?.evidence.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('extracts Stripe identifiers, version/date, replacement, and source evidence', () => {
    const result = parseStripeChangelog(fixtures.stripe, { sourceUrl: 'https://example.test/stripe-replay' });
    expect(result.rejected).toHaveLength(0);
    expect(result.changes[0]).toMatchObject({
      provider: 'stripe',
      changeType: 'endpoint_removed',
      dates: { effective: '2027-03-01' },
      replacement: { kind: 'endpoint', value: '/v1/promotion_codes' },
      evidence: { sourceUrl: 'https://example.test/stripe-replay' },
    });
    expect(result.changes[0]?.identifiers).toEqual([
      { kind: 'api_version', value: '2024-10-01' },
      { kind: 'endpoint', value: '/v1/coupons' },
    ]);
  });

  it('extracts provider-specific identifiers for Twilio, Firebase, GitHub, and AWS', () => {
    expect(parseTwilioChangelog(fixtures.twilio).changes[0]).toMatchObject({ changeType: 'endpoint_removed' });
    expect(parseTwilioChangelog(fixtures.twilio).changes[0]?.identifiers).toEqual(expect.arrayContaining([{ kind: 'endpoint', value: '/2010-04-01/Messages' }]));
    expect(parseFirebaseChangelog(fixtures.firebase).changes[0]).toMatchObject({ changeType: 'sdk_method_removed' });
    expect(parseFirebaseChangelog(fixtures.firebase).changes[0]?.identifiers).toEqual(expect.arrayContaining([{ kind: 'sdk_method', value: 'firebase.database' }]));
    expect(parseGitHubChangelog(fixtures.github).changes[0]).toMatchObject({ changeType: 'endpoint_removed', dates: { effective: '2027-06-30' } });
    expect(parseAwsChangelog(fixtures.aws).changes[0]).toMatchObject({ changeType: 'service_deprecated', identifiers: [{ kind: 'service', value: 'AWS SDK for JavaScript v2' }] });
  });

  it('extracts OpenAI model retirement and replacement from a replayed table', () => {
    const result = parseOpenAiChangelog(fixtures.openai);
    expect(result.changes[0]).toMatchObject({
      changeType: 'model_retired',
      dates: { effective: '2027-08-15' },
      identifiers: [{ kind: 'model', value: 'old-model' }],
      replacement: { kind: 'model', value: 'new-model' },
    });
  });

  it('is deterministic and fail-closed when lifecycle text has no identifier', () => {
    const input = '<p>2027-09-01 breaking change: an unspecified endpoint is removed.</p>';
    const first = parseStripeChangelog(input);
    const second = parseStripeChangelog(input);
    expect(first).toEqual(second);
    expect(first.changes).toHaveLength(0);
    expect(first.rejected).toEqual([{ provider: 'stripe', reason: 'missing_identifier', excerpt: '2027-09-01 breaking change: an unspecified endpoint is removed.', locator: 'entry-1' }]);
  });

  it('rejects contradictory support/removal claims instead of creating an overconfident change', () => {
    const result = parseStripeChangelog('<article><p>2027-09-10: the <code>/v1/coupons</code> endpoint is removed.</p><p>The endpoint remains supported and the removal was cancelled.</p></article>');
    expect(result.changes).toHaveLength(0);
    expect(result.rejected).toEqual([expect.objectContaining({ reason: 'contradictory_evidence', locator: 'entry-1' })]);
    expect(result.rejected[0]?.excerpt).toContain('/v1/coupons');
  });

  it('retains semantic changes as review-only rejections', () => {
    const result = parseOpenAiChangelog('<p>2027-09-11: the behavior of <code>chat.completions.create</code> has changed.</p>');
    expect(result.changes).toHaveLength(0);
    expect(result.rejected).toEqual([expect.objectContaining({ reason: 'unsupported_change', locator: 'entry-1' })]);
  });

  it('ignores stable prose without a lifecycle notice and does not invent identifiers', () => {
    const result = parseAwsChangelog('<p>AWS SDK for JavaScript v3 is supported and current.</p>');
    expect(result.changes).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it('keeps the provider profile catalog available for review semantics', () => {
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => source.adapterId === 'profiled-official-source')).toHaveLength(0);
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => DEDICATED_TIER_3_PROVIDERS.includes(source.adapterId as (typeof DEDICATED_TIER_3_PROVIDERS)[number]))).toHaveLength(7);
    expect(parseProviderChangelogBody('supabase', '2027-01-01: `PostgREST` service is removed.').parserStatus).toBe('structured');
  });

  it('uses dedicated Tier-3 parsers for concrete lifecycle identifiers', () => {
    const fixtures: Record<(typeof DEDICATED_TIER_3_PROVIDERS)[number], string> = {
      supabase: '2027-02-01: `logs.all` endpoint is removed; use `analytics/endpoints/logs`.',
      vercel: '2027-02-02: `/v1/projects` endpoint removed; use `/v2/projects`.',
      cloudflare: '2027-02-03: `Workers` service deprecated; use `Durable Objects`.',
      launchdarkly: '2027-02-04: `flags` endpoint deprecated; use `flags/v2`.',
      elevenlabs: '2027-02-05: `text-to-speech` operation deprecated; use `speech-to-speech`.',
      groq: '2027-02-06: model `llama-3.1-8b` retired; use `llama-4-8b`.',
      braintree: '2027-02-07: `transaction` operation deprecated; use `transaction/v2`.',
    };
    for (const provider of DEDICATED_TIER_3_PROVIDERS) {
      const result = parseDedicatedProviderChangelog(provider, fixtures[provider], { sourceUrl: `https://official.example/${provider}` });
      expect(result.provider, provider).toBe(provider);
      expect(result.changes, provider).toHaveLength(1);
      expect(result.changes[0]?.evidence.sourceUrl, provider).toBe(`https://official.example/${provider}`);
      expect(result.changes[0]?.dates.effective, provider).toBe(`2027-02-0${DEDICATED_TIER_3_PROVIDERS.indexOf(provider) + 1}`);
      expect(result.changes[0]?.identifiers.length, provider).toBeGreaterThan(0);
    }
  });

  it('uses dedicated Tier-2 parsers for concrete lifecycle identifiers', () => {
    const fixtures: Record<(typeof DEDICATED_TIER_2_PROVIDERS)[number], string> = {
      'google-cloud': '2027-01-01: `com.google.cloud:old-client` is removed; use `com.google.cloud:new-client`.',
      slack: '2027-01-02: the `chat.postMessage` operation is deprecated; use `chat.send`.',
      sendgrid: '2027-01-03: the `/v3/mail/send` endpoint is removed; use `/v3/mail/send2`.',
      shopify: '2027-01-04: API version `2027-01` is retired; migrate to `2027-04`.',
      auth0: '2027-01-05: the `/oauth/token` endpoint is deprecated; use `/oauth/token2`.',
      clerk: '2027-01-06: the `Backend API` operation is removed; use `Frontend API`.',
    };
    for (const provider of DEDICATED_TIER_2_PROVIDERS) {
      const result = parseDedicatedTier2ProviderChangelog(provider, fixtures[provider], { sourceUrl: `https://official.example/${provider}` });
      expect(result.provider, provider).toBe(provider);
      expect(result.changes, provider).toHaveLength(1);
      expect(result.changes[0]?.evidence.sourceUrl, provider).toBe(`https://official.example/${provider}`);
      expect(result.changes[0]?.dates.effective, provider).toBe(`2027-01-0${DEDICATED_TIER_2_PROVIDERS.indexOf(provider) + 1}`);
      expect(result.changes[0]?.identifiers.length, provider).toBeGreaterThan(0);
    }
  });

  it('rejects dedicated Tier-2 lifecycle prose without a concrete identifier', () => {
    for (const provider of DEDICATED_TIER_2_PROVIDERS) {
      const result = parseDedicatedTier2ProviderChangelog(provider, '2027-02-01: a breaking change is announced without a concrete API surface.', { sourceUrl: `https://official.example/${provider}` });
      expect(result.changes, provider).toHaveLength(0);
      expect(result.rejected, provider).toHaveLength(1);
      expect(result.rejected[0]?.reason, provider).toBe('missing_identifier');
    }
  });
});
