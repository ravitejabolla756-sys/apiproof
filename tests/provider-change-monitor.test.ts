import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { PROVIDER_CHANGE_SOURCES, refreshAllProviderChangelogs, refreshProviderChangelog } from '../apps/web/src/lib/server/provider-change-monitor.js';
import { getProviderSourceHealth } from '../apps/web/src/lib/server/provider-source-health.js';
import { DEDICATED_TIER_2_PROVIDERS, DEDICATED_TIER_3_PROVIDERS, getProviderChangelogProfile, PROFILED_PROVIDER_CHANGELOGS, TIER_1_PROVIDERS } from '../apps/web/src/lib/server/provider-changelog-adapters.js';
import { approveProviderRuleCandidate, editProviderRuleCandidate } from '../apps/web/src/lib/server/provider-rule-service.js';

const reviewEvidence = (affected: string, unaffected: string, uncertain = 'const value = maybeDynamicInput;') => ({
  cases: [
    { kind: 'affected', filePath: 'review/affected.ts', code: affected, rationale: 'The reviewed token is present in the affected usage.' },
    { kind: 'unaffected', filePath: 'review/unaffected.ts', code: unaffected, rationale: 'The reviewed token is absent from this unaffected usage.' },
    { kind: 'uncertain', filePath: 'review/uncertain.ts', code: uncertain, rationale: 'This usage requires human follow-up because its meaning is ambiguous.' },
  ],
});
import { loadActiveProductionRegistry } from '../apps/web/src/lib/server/registry-utils.js';
import { runProductizationScan } from '@apiproof/analyzers';
import { enqueueNightlyRescans } from '../apps/web/src/lib/server/repository-rescan-worker.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-change-monitor.db');
const resolvePublicHost = async (_hostname: string, _options: { all: true; verbatim: true }): Promise<readonly { address: string }[]> => [{ address: '93.184.216.34' }];

describe('provider change monitoring foundation', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('declares exactly the requested 19 provider sources', () => {
    expect(PROVIDER_CHANGE_SOURCES).toHaveLength(19);
    expect(new Set(PROVIDER_CHANGE_SOURCES.map((source) => source.providerId)).size).toBe(19);
    expect(PROVIDER_CHANGE_SOURCES.every((source) => new URL(source.sourceUrl).protocol === 'https:')).toBe(true);
  });

  it('honors the six-hour source schedule for full catalog refreshes', async () => {
    let fetchCount = 0;
    const fetchImpl = async (): Promise<Response> => {
      fetchCount += 1;
      return new Response('<p>stable official source</p>', { status: 200, headers: { 'content-type': 'text/html' } });
    };
    const firstRunAt = new Date('2027-01-01T00:00:00.000Z');
    const first = await refreshAllProviderChangelogs({ fetchImpl, resolveHost: resolvePublicHost, now: () => firstRunAt });
    expect(first).toHaveLength(19);
    expect(first.every((result) => result.status === 'baseline')).toBe(true);
    expect(fetchCount).toBe(19);

    const beforeDue = await refreshAllProviderChangelogs({
      fetchImpl,
      resolveHost: resolvePublicHost,
      now: () => new Date('2027-01-01T01:00:00.000Z'),
    });
    expect(beforeDue).toHaveLength(19);
    expect(beforeDue.every((result) => result.status === 'skipped' && result.skipReason === 'not_due')).toBe(true);
    expect(fetchCount).toBe(19);

    const due = await refreshAllProviderChangelogs({
      fetchImpl,
      resolveHost: resolvePublicHost,
      now: () => new Date('2027-01-01T07:00:00.000Z'),
    });
    expect(due).toHaveLength(19);
    expect(due.every((result) => result.status === 'unchanged')).toBe(true);
    expect(fetchCount).toBe(38);
  });

  it('retries transient source failures before recording a failed refresh', async () => {
    let attempts = 0;
    const result = await refreshProviderChangelog('slack', {
      fetchImpl: async () => {
        attempts += 1;
        return attempts < 3
          ? new Response('temporarily unavailable', { status: 503 })
          : new Response('<p>stable official source</p>', { status: 200, headers: { 'content-type': 'text/html' } });
      },
      resolveHost: resolvePublicHost,
      retryDelayMs: 0,
      now: () => new Date('2027-01-01T00:00:00.000Z'),
    });
    expect(result.status).toBe('baseline');
    expect(attempts).toBe(3);
  });

  it('honors a bounded Retry-After response when a provider rate-limits a fetch', async () => {
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      if (attempts === 1) return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } });
      return new Response('<html><body>Slack changelog stable</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }) as typeof fetch;
    const result = await refreshProviderChangelog('slack', { fetchImpl, resolveHost: resolvePublicHost, retryDelayMs: 10_000 });
    expect(result.status).toBe('baseline');
    expect(attempts).toBe(2);
  });

  it('reports source health independently from reviewed scanner coverage', async () => {
    const beforeRun = await getProviderSourceHealth(new Date('2027-01-01T00:00:00.000Z'));
    expect(beforeRun).toHaveLength(19);
    expect(beforeRun.every((source) => source.status === 'never-run' && source.parserStatus === 'not-run')).toBe(true);

    await refreshProviderChangelog('openai', {
      fetchImpl: async () => new Response('<p>stable</p>', { status: 200, headers: { 'content-type': 'text/html' } }),
      resolveHost: resolvePublicHost,
      now: () => new Date('2027-01-01T00:00:00.000Z'),
    });
    const afterRun = await getProviderSourceHealth(new Date('2027-01-01T01:00:00.000Z'));
    expect(afterRun.find((source) => source.providerId === 'openai')).toMatchObject({ status: 'healthy', failureCount: 0, parserStatus: 'review-only' });
    expect(afterRun.find((source) => source.providerId === 'stripe')).toMatchObject({ status: 'never-run', parserStatus: 'not-run' });
  });

  it('advertises dedicated parser coverage for every Tier 1 source', () => {
    const sourceByProvider = new Map(PROVIDER_CHANGE_SOURCES.map((source) => [source.providerId, source]));
    for (const provider of TIER_1_PROVIDERS) {
      expect(sourceByProvider.get(provider)?.adapterId).toBe(provider);
    }
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => source.adapterId === 'profiled-official-source')).toHaveLength(0);
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => DEDICATED_TIER_2_PROVIDERS.includes(source.adapterId as (typeof DEDICATED_TIER_2_PROVIDERS)[number]))).toHaveLength(6);
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => DEDICATED_TIER_3_PROVIDERS.includes(source.adapterId as (typeof DEDICATED_TIER_3_PROVIDERS)[number]))).toHaveLength(7);
    expect(PROVIDER_CHANGE_SOURCES.filter((source) => source.adapterId === 'generic-official-source')).toHaveLength(0);
  });

  it('keeps every non-Tier-1 source attached to a concrete identifier profile', () => {
    const profileFixtures: Record<string, string> = {
      'google-cloud': '2027-01-01 breaking change: `com.google.cloud:old-client` is removed',
      slack: '2027-01-01 breaking change: `chat.history` is removed',
      sendgrid: '2027-01-01 breaking change: `mail/send` is removed',
      shopify: '2027-01-01 breaking change: the `2027-10` Admin API version is removed',
      auth0: '2027-01-01 breaking change: `/api/v2` is removed',
      clerk: '2027-01-01 breaking change: the `Backend API` operation is removed',
      supabase: '2027-01-01 breaking change: `PostgREST` is removed',
      vercel: '2027-01-01 breaking change: `/v1/projects` is removed',
      cloudflare: '2027-01-01 breaking change: `Workers` is removed',
      launchdarkly: '2027-01-01 breaking change: `api.launchdarkly.com` is removed',
      elevenlabs: '2027-01-01 breaking change: `text-to-speech` is removed',
      groq: '2027-01-01 breaking change: `chat.completions` is removed',
      braintree: '2027-01-01 breaking change: `transaction` is removed',
    };
    expect(PROFILED_PROVIDER_CHANGELOGS).toHaveLength(13);
    for (const [provider, fixture] of Object.entries(profileFixtures)) {
      const profile = getProviderChangelogProfile(provider);
      expect(profile?.identifierPatterns.length, provider).toBeGreaterThan(0);
      expect(profile?.identifierPatterns.some((pattern) => pattern.test(fixture)), provider).toBe(true);
    }
  });

  it('runs every dedicated non-Tier-1 source through the monitor and creates a bounded review candidate', async () => {
    const profileFixtures: Record<string, string> = {
      'google-cloud': '2027-01-01 breaking change: `com.google.cloud:old-client` is removed',
      slack: '2027-01-01 breaking change: `chat.history` is removed',
      sendgrid: '2027-01-01 breaking change: `mail/send` is removed',
      shopify: '2027-01-01 breaking change: the `2027-10` Admin API version is removed',
      auth0: '2027-01-01 breaking change: `/api/v2` is removed',
      clerk: '2027-01-01 breaking change: the `Backend API` operation is removed',
      supabase: '2027-01-01 breaking change: `PostgREST` is removed',
      vercel: '2027-01-01 breaking change: `/v1/projects` is removed',
      cloudflare: '2027-01-01 breaking change: `Workers` is removed',
      launchdarkly: '2027-01-01 breaking change: `api.launchdarkly.com` is removed',
      elevenlabs: '2027-01-01 breaking change: `text-to-speech` is removed',
      groq: '2027-01-01 breaking change: `chat.completions` is removed',
      braintree: '2027-01-01 breaking change: `transaction` is removed',
    };
    const dedicatedSources = PROVIDER_CHANGE_SOURCES.filter((source) => source.adapterId !== 'profiled-official-source' && source.adapterId !== 'generic-official-source' && !TIER_1_PROVIDERS.includes(source.adapterId as (typeof TIER_1_PROVIDERS)[number]));
    const bodyByUrl = new Map(dedicatedSources.map((source) => [source.sourceUrl, `<p>${source.providerId} baseline</p>`]));
    const fetchImpl = async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      const url = input.toString();
      const source = PROVIDER_CHANGE_SOURCES.find((candidate) => candidate.sourceUrl === url);
      const body = source ? bodyByUrl.get(source.sourceUrl) ?? profileFixtures[source.providerId] ?? 'stable' : 'stable';
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    };
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    for (const source of dedicatedSources) {
      await refreshProviderChangelog(source.providerId, options);
      bodyByUrl.set(source.sourceUrl, profileFixtures[source.providerId]!);
      await refreshProviderChangelog(source.providerId, options);
    }
    const candidates = await getDatabase().query<{ provider_id: string; status: string; payload_json: string }>('SELECT provider_id, status, payload_json FROM provider_rule_candidates ORDER BY provider_id');
    expect(candidates).toHaveLength(13);
    expect(candidates.every((candidate) => candidate.status === 'needs_review')).toBe(true);
    expect(candidates.map((candidate) => candidate.provider_id)).toEqual(dedicatedSources.map((source) => source.providerId).sort());
    const expectedShapes: Record<string, { changeType: string; dimensions: string[]; identifier: string }> = {
      'google-cloud': { changeType: 'endpoint_removed', dimensions: ['provider', 'resource'], identifier: 'com.google.cloud:old-client' },
      slack: { changeType: 'endpoint_removed', dimensions: ['provider', 'operation'], identifier: 'chat.history' },
      sendgrid: { changeType: 'endpoint_removed', dimensions: ['provider', 'endpoint'], identifier: 'mail/send' },
      shopify: { changeType: 'api_version_retired', dimensions: ['provider', 'api_version'], identifier: '2027-10' },
      auth0: { changeType: 'endpoint_removed', dimensions: ['provider', 'endpoint'], identifier: '/api/v2' },
      clerk: { changeType: 'endpoint_removed', dimensions: ['provider', 'operation'], identifier: 'Backend API' },
      supabase: { changeType: 'endpoint_removed', dimensions: ['provider', 'resource'], identifier: 'PostgREST' },
      vercel: { changeType: 'endpoint_removed', dimensions: ['provider', 'endpoint'], identifier: '/v1/projects' },
      cloudflare: { changeType: 'endpoint_removed', dimensions: ['provider', 'resource'], identifier: 'Workers' },
      launchdarkly: { changeType: 'endpoint_removed', dimensions: ['provider', 'endpoint'], identifier: 'api.launchdarkly.com' },
      elevenlabs: { changeType: 'endpoint_removed', dimensions: ['provider', 'operation'], identifier: 'text-to-speech' },
      groq: { changeType: 'endpoint_removed', dimensions: ['provider', 'operation'], identifier: 'chat.completions' },
      braintree: { changeType: 'endpoint_removed', dimensions: ['provider', 'operation'], identifier: 'transaction' },
    };
    for (const candidate of candidates) {
      const expected = expectedShapes[candidate.provider_id]!;
      const payload = JSON.parse(candidate.payload_json) as Record<string, unknown>;
      expect(payload).toMatchObject({ changeType: expected.changeType, applicabilityScope: { dimensions: expected.dimensions } });
      const identifiers = [
        ...(Array.isArray(payload.affectedResources) ? payload.affectedResources : []),
        ...(Array.isArray(payload.affectedEndpoints) ? payload.affectedEndpoints : []),
        ...(Array.isArray(payload.apiOperationPatterns) ? payload.apiOperationPatterns : []),
        ...(typeof payload.apiVersionMetadata === 'object' && payload.apiVersionMetadata ? [((payload.apiVersionMetadata as Record<string, unknown>).version)] : []),
      ];
      expect(identifiers).toContain(expected.identifier);
    }
  });

  it('marks ambiguous dedicated-source changes review-only instead of silently compiling them', async () => {
    const dedicatedSources = PROVIDER_CHANGE_SOURCES.filter((source) => source.adapterId !== 'profiled-official-source' && source.adapterId !== 'generic-official-source' && !TIER_1_PROVIDERS.includes(source.adapterId as (typeof TIER_1_PROVIDERS)[number]));
    const bodyByUrl = new Map(dedicatedSources.map((source) => [source.sourceUrl, `<p>${source.providerId} baseline</p>`]));
    const fetchImpl = async (input: Parameters<typeof fetch>[0]): Promise<Response> => new Response(bodyByUrl.get(input.toString()) ?? '<p>stable</p>', { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    for (const source of dedicatedSources) {
      await refreshProviderChangelog(source.providerId, options);
      bodyByUrl.set(source.sourceUrl, '<p>breaking change announced without a concrete identifier</p>');
      const result = await refreshProviderChangelog(source.providerId, options);
      expect(result.parserStatus, source.providerId).toBe('review-only');
    }
  });

  it('uses provider-specific identifier profiles while retaining human review', async () => {
    let body = '<p>Slack baseline</p>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('slack', options);
    body = '<p>2027-01-01 breaking change: <code>conversations.history</code> is removed</p>';
    const result = await refreshProviderChangelog('slack', options);
    expect(result.detectedChanges).toBe(1);
    const candidate = await getDatabase().queryOne<{ status: string; payload_json: string }>('SELECT status, payload_json FROM provider_rule_candidates');
    expect(candidate?.status).toBe('needs_review');
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({ changeType: 'endpoint_removed', affectedParameters: [], apiOperationPatterns: ['conversations.history'], applicabilityScope: { dimensions: ['provider', 'operation'] } });
  });

  it('records explicit parser status and preserves provider-specific resource semantics', async () => {
    let body = '<p>Cloudflare baseline</p>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    const baseline = await refreshProviderChangelog('cloudflare', options);
    expect(baseline.parserStatus).toBe('review-only');

    body = '<p>2027-01-01 breaking change: <code>Workers</code> is removed. Use <code>Durable Objects</code> instead.</p>';
    const changed = await refreshProviderChangelog('cloudflare', options);
    expect(changed.parserStatus).toBe('structured');
    const candidate = await getDatabase().queryOne<{ payload_json: string }>('SELECT payload_json FROM provider_rule_candidates');
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({
      changeType: 'endpoint_removed',
      affectedResources: ['Workers'],
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      sourceFacts: [expect.stringContaining('Workers')],
    });
  });

  it('creates a durable nightly rescan job only for repositories older than the one-hour freshness window', async () => {
    const now = new Date('2026-10-29T00:00:00.000Z');
    await getDatabase().execute('UPDATE repositories SET lifecycle = \'active\', status = \'connected\', last_scan_at = ?', [new Date(now.getTime() - 61 * 60 * 1000).toISOString()]);
    expect(await enqueueNightlyRescans(now)).toBe(1);
    expect(await getDatabase().queryOne<{ reason: string; status: string }>('SELECT reason, status FROM repository_rescan_jobs')).toEqual({ reason: 'nightly_rescan', status: 'pending' });
    expect(await enqueueNightlyRescans(now)).toBe(0);
  });

  it('records a first snapshot as a baseline and creates a review candidate only after a source change', async () => {
    let body = '<html>stripe baseline</html>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html', etag: 'v1' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    expect((await refreshProviderChangelog('stripe', options)).status).toBe('baseline');
    expect(await getDatabase().query('SELECT id FROM provider_rule_candidates')).toHaveLength(0);
    body = '<html>stripe breaking update</html>';
    const changed = await refreshProviderChangelog('stripe', options);
    expect(changed.status).toBe('changed');
    expect(changed.candidateId).toBeTruthy();
    const candidate = await getDatabase().queryOne<{ status: string; payload_json: string }>('SELECT status, payload_json FROM provider_rule_candidates');
    expect(candidate?.status).toBe('needs_review');
    expect(JSON.parse(candidate!.payload_json).unknowns).toContain('Exact affected API surface requires human review.');
  });

  it('fails closed on an off-catalog redirect and records the failure', async () => {
    const fetchImpl = async (): Promise<Response> => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    const result = await refreshProviderChangelog('twilio', { fetchImpl, resolveHost: resolvePublicHost });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('SOURCE_URL_NOT_ALLOWLISTED');
  });

  it('rejects a redirect from one provider source to another provider host', async () => {
    const fetchImpl = async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      const url = input.toString();
      if (url === 'https://www.twilio.com/en-us/changelog') {
        return new Response(null, { status: 302, headers: { location: 'https://stripe.com/docs/upgrades' } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };
    const result = await refreshProviderChangelog('twilio', { fetchImpl, resolveHost: resolvePublicHost });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('SOURCE_URL_NOT_ALLOWLISTED');
  });

  it('refreshes all providers with bounded fan-out and returns one result per source', async () => {
    const fetchImpl = async (): Promise<Response> => new Response('stable', { status: 200, headers: { 'content-type': 'text/plain' } });
    const results = await refreshAllProviderChangelogs({ fetchImpl, resolveHost: resolvePublicHost });
    expect(results).toHaveLength(19);
    expect(results.every((result) => result.status === 'baseline')).toBe(true);
  });

  it('only emits a typed non-OpenAI candidate when a concrete lifecycle notice is present', async () => {
    let body = '<p>Twilio release notes</p>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('twilio', options);
    body = '<p>2027-01-01 endpoint <code>/v1/messages</code> removed</p>';
    await refreshProviderChangelog('twilio', options);
    const candidate = await getDatabase().queryOne<{ payload_json: string }>('SELECT payload_json FROM provider_rule_candidates');
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({ changeType: 'endpoint_removed', affectedEndpoints: ['/v1/messages'] });
  });

  it('does not approve an unstructured document fingerprint as a production rule', async () => {
    let body = 'first';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
    await refreshProviderChangelog('openai', { fetchImpl, resolveHost: resolvePublicHost });
    body = 'second';
    await refreshProviderChangelog('openai', { fetchImpl, resolveHost: resolvePublicHost });
    const candidate = await getDatabase().queryOne<{ id: string }>('SELECT id FROM provider_rule_candidates');
    await expect(approveProviderRuleCandidate(candidate!.id, 'reviewer-1', 'Reviewed source; structured scope is missing.')).rejects.toThrow('RULE_CANDIDATE_REQUIRES_STRUCTURED_REVIEW');
  });

  it('requires three bounded review outcomes before approving a structured candidate', async () => {
    let body = '<table><tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('openai', options);
    body = '<table><tr><td>2027-02-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    await refreshProviderChangelog('openai', options);
    const candidate = await getDatabase().queryOne<{ id: string }>('SELECT id FROM provider_rule_candidates');
    await expect(approveProviderRuleCandidate(candidate!.id, 'reviewer-1', 'The source is structured, but fixture evidence was not supplied.')).rejects.toThrow('RULE_REVIEW_EVIDENCE');
  });

  it('preserves an approved candidate when the source changes without changing its structured rule payload', async () => {
    const { user } = await createUserWithSession('source-change-requeue@example.com', 'Pass1234!', 'Source Change Requeue');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repositoryId = 'source-change-repository';
    const now = new Date().toISOString();
    await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', 'source-change-repository', 'test-org/source-change-repository', '7654399', 'main', 'connected', 'active', ?)`, [repositoryId, workspace.id, user.id, now]);
    const scanId = 'source-change-baseline-scan';
    await getDatabase().execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repositoryId, 'a'.repeat(40), now, now]);
    await getDatabase().execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, 'openai', ?, ?, ?, ?)`, [repositoryId, workspace.id, scanId, now, now, now]);

    let body = '<table><tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };

    await refreshProviderChangelog('openai', options);
    body = '<table>\n  <tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr>\n</table>';
    await refreshProviderChangelog('openai', options);

    const candidate = await getDatabase().queryOne<{ id: string }>('SELECT id FROM provider_rule_candidates');
    expect(candidate).toBeDefined();
    await approveProviderRuleCandidate(
      candidate!.id,
      'reviewer-1',
      'Confirmed the official model retirement and replacement.',
      workspace.id,
      reviewEvidence("client.chat.completions.create({ model: 'old-model' })", "client.chat.completions.create({ model: 'current-model' })"),
    );
    await getDatabase().execute("UPDATE provider_rescan_jobs SET status = 'completed' WHERE repository_id = ? AND rule_candidate_id = ?", [repositoryId, candidate!.id]);

    // Simulate a candidate persisted by the pre-upgrade payload-only
    // fingerprint algorithm. The next source refresh must reuse it instead
    // of creating a second candidate with the provider-scoped fingerprint.
    const persistedPayload = await getDatabase().queryOne<{ payload_json: string }>(
      'SELECT payload_json FROM provider_rule_candidates WHERE id = ?',
      [candidate!.id],
    );
    const legacyFingerprint = crypto.createHash('sha256')
      .update(persistedPayload!.payload_json)
      .digest('hex');
    await getDatabase().execute(
      'UPDATE provider_rule_candidates SET candidate_fingerprint = ? WHERE id = ?',
      [legacyFingerprint, candidate!.id],
    );

    body = '<table>\n  <tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr>\n</table>\n<!-- provider page footer changed -->';
    const changed = await refreshProviderChangelog('openai', options);

    expect(await getDatabase().queryOne<{ status: string }>('SELECT status FROM provider_rule_candidates WHERE id = ?', [candidate!.id])).toEqual({ status: 'approved' });
    expect(await getDatabase().query<{ provider_id: string }>('SELECT provider_id FROM provider_rule_candidates')).toHaveLength(1);
    expect(changed.rescansQueued).toBe(1);
    expect(await getDatabase().queryOne<{ reason: string; status: string }>('SELECT reason, status FROM provider_rescan_jobs WHERE repository_id = ?', [repositoryId])).toEqual({ reason: 'provider_source_changed', status: 'pending' });
  });

  it('extracts a bounded OpenAI model deprecation and approval queues every eligible repository', async () => {
    await getDatabase().execute("UPDATE repositories SET lifecycle = 'active', status = 'connected'");
    const seededRepository = await getDatabase().queryOne<{ workspace_id: string; user_id: string }>('SELECT workspace_id, user_id FROM repositories LIMIT 1');
    const now = new Date().toISOString();
    for (const [id, status] of [['healthy-repo', 'healthy'], ['affected-repo', 'affected']] as const) {
      await getDatabase().execute(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at)
        VALUES (?, ?, ?, 'test-org', ?, ?, ?, 'main', ?, 'active', ?)
      `, [id, seededRepository!.workspace_id, seededRepository!.user_id, id, `test-org/${id}`, id === 'healthy-repo' ? '900001' : '900002', status, now]);
    }
    let body = '<table><tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('openai', options);
    body = '<table><tr><td>2027-02-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    const changed = await refreshProviderChangelog('openai', options);
    const candidate = await getDatabase().queryOne<{ id: string; payload_json: string }>('SELECT id, payload_json FROM provider_rule_candidates');
    expect(changed.detectedChanges).toBe(1);
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({ changeType: 'model_retired', affectedModels: ['old-model'] });
    const approved = await approveProviderRuleCandidate(candidate!.id, 'reviewer-1', 'Confirmed the official model shutdown row.', undefined, reviewEvidence("client.chat.completions.create({ model: 'old-model' })", "client.chat.completions.create({ model: 'current-model' })"));
    expect(approved.repositoriesQueued).toBe(3);
    const activeRegistry = await loadActiveProductionRegistry();
    expect(activeRegistry.changes.some((change) => change.changeId === JSON.parse(candidate!.payload_json).changeId)).toBe(true);
    expect((await getDatabase().queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs'))?.status).toBe('pending');
    const persistedReview = await getDatabase().queryOne<{ evidence_json: string }>('SELECT evidence_json FROM provider_rule_reviews WHERE rule_candidate_id = ? AND decision = \'approved\' ORDER BY created_at DESC LIMIT 1', [candidate!.id]);
    expect(JSON.parse(persistedReview!.evidence_json).cases).toHaveLength(3);
    const scan = await runProductizationScan({
      repositoryId: 'repo-1',
      baselineSha: 'a'.repeat(40),
      scanId: 'scan-1',
      registry: activeRegistry,
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
        ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'old-model', messages: [] });"],
      ]),
    });
    expect(scan.compatibilityResults.some((result) => result.changeId === JSON.parse(candidate!.payload_json).changeId && result.status === 'AFFECTED')).toBe(true);
  });

  it('normalizes a Firebase SDK-method deprecation into an approved, scannable rule', async () => {
    let body = '<p>Firebase baseline</p>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('firebase', options);
    body = '<article><h3>2027-05-20</h3><p>Firebase JS SDK deprecation: <code>firebase.database()</code> is no longer supported. Use <code>firebase.firestore()</code>.</p></article>';
    const changed = await refreshProviderChangelog('firebase', options);
    const candidate = await getDatabase().queryOne<{ id: string; payload_json: string }>('SELECT id, payload_json FROM provider_rule_candidates');
    expect(changed.detectedChanges).toBe(1);
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({
      changeType: 'method_removed',
      applicabilityScope: { dimensions: ['provider', 'operation'] },
      apiOperationPatterns: expect.arrayContaining(['firebase.database', 'database']),
    });

    await editProviderRuleCandidate(candidate!.id, 'reviewer-1', {
      applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] },
      affectedPackages: ['firebase'],
      affectedVersionRange: '>=1.0.0',
    }, 'Bound the reviewed SDK method rule to the Firebase package and supported version range.');
    await approveProviderRuleCandidate(candidate!.id, 'reviewer-1', 'Confirmed Firebase database API removal and replacement guidance.', undefined, reviewEvidence('firebase.database()', 'firebase.firestore()'));

    const activeRegistry = await loadActiveProductionRegistry();
    const payload = JSON.parse((await getDatabase().queryOne<{ payload_json: string }>('SELECT payload_json FROM provider_rule_candidates WHERE id = ?', [candidate!.id]))!.payload_json) as { changeId: string };
    expect(activeRegistry.changes.some((change) => change.changeId === payload.changeId && change.providerId === 'firebase')).toBe(true);
    const scan = await runProductizationScan({
      repositoryId: 'firebase-repo-1',
      baselineSha: 'b'.repeat(40),
      scanId: 'firebase-scan-1',
      registry: activeRegistry,
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { firebase: '10.0.0' } })],
        ['package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { firebase: '10.0.0' } }, 'node_modules/firebase': { version: '10.0.0' } } })],
        ['src/firebase.ts', "import firebase from 'firebase'; const db = firebase.database();"],
      ]),
    });
    expect(scan.compatibilityResults.some((result) => result.changeId === payload.changeId && result.status === 'AFFECTED')).toBe(true);
  });

  it('normalizes a Tier-2 Slack operation retirement into an approved, scannable rule', async () => {
    let body = '<p>Slack baseline</p>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };

    await refreshProviderChangelog('slack', options);
    body = '<article><h3>2027-06-20</h3><p>Slack breaking change: <code>conversations.history</code> is removed. Use <code>conversations.list</code>.</p></article>';
    const changed = await refreshProviderChangelog('slack', options);
    const candidate = await getDatabase().queryOne<{ id: string; payload_json: string }>('SELECT id, payload_json FROM provider_rule_candidates');
    expect(changed.parserStatus).toBe('structured');
    expect(changed.detectedChanges).toBe(1);
    expect(JSON.parse(candidate!.payload_json)).toMatchObject({
      changeType: 'endpoint_removed',
      applicabilityScope: { dimensions: ['provider', 'operation'] },
      apiOperationPatterns: ['conversations.history'],
    });

    await getDatabase().execute("UPDATE repositories SET lifecycle = 'active', status = 'connected'");
    const approved = await approveProviderRuleCandidate(candidate!.id, 'reviewer-1', 'Confirmed the Slack changelog operation retirement and replacement guidance.', undefined, reviewEvidence('client.conversations.history({ channel: "C123" })', 'client.conversations.list()'));
    expect(approved.repositoriesQueued).toBe(1);

    const activeRegistry = await loadActiveProductionRegistry();
    const payload = JSON.parse((await getDatabase().queryOne<{ payload_json: string }>('SELECT payload_json FROM provider_rule_candidates WHERE id = ?', [candidate!.id]))!.payload_json) as { changeId: string };
    expect(activeRegistry.changes.some((change) => change.changeId === payload.changeId && change.providerId === 'slack')).toBe(true);
    expect((await getDatabase().queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs'))?.status).toBe('pending');

    const scan = await runProductizationScan({
      repositoryId: 'slack-repo-1',
      baselineSha: 'c'.repeat(40),
      scanId: 'slack-scan-1',
      registry: activeRegistry,
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { '@slack/web-api': '7.8.0' } })],
        ['src/slack.ts', "import { WebClient } from '@slack/web-api'; const client = new WebClient(); await client.conversations.history({ channel: 'C123' });"],
      ]),
    });
    expect(scan.usageIR.map((usage) => ({ providerId: usage.providerId, operation: usage.operation, packageName: usage.packageName }))).toEqual(expect.arrayContaining([{ providerId: 'slack', operation: 'conversations.history', packageName: '@slack/web-api' }]));
  });

  it('allows audited pattern and replacement edits while the candidate remains unapproved', async () => {
    let body = '<table><tr><td>2027-01-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('openai', options);
    body = '<table><tr><td>2027-02-01</td><td><code>old-model</code></td><td><code>new-model</code></td></tr></table>';
    await refreshProviderChangelog('openai', options);
    const candidate = await getDatabase().queryOne<{ id: string; status: string; payload_json: string; candidate_fingerprint: string }>('SELECT id, status, payload_json, candidate_fingerprint FROM provider_rule_candidates');
    const beforeFingerprint = candidate!.candidate_fingerprint;
    await editProviderRuleCandidate(candidate!.id, 'reviewer-1', {
      title: 'OpenAI old model migration',
      apiOperationPatterns: ['client.chat.completions.create'],
      replacement: { model: 'new-model' },
    }, 'Bound the rule to the reviewed chat completion call and documented the replacement model.');
    const edited = await getDatabase().queryOne<{ status: string; payload_json: string; candidate_fingerprint: string }>('SELECT status, payload_json, candidate_fingerprint FROM provider_rule_candidates WHERE id = ?', [candidate!.id]);
    expect(edited?.status).toBe('needs_review');
    expect(edited?.candidate_fingerprint).not.toBe(beforeFingerprint);
    expect(JSON.parse(edited!.payload_json)).toMatchObject({ title: 'OpenAI old model migration', apiOperationPatterns: ['client.chat.completions.create'], replacement: { model: 'new-model' } });
    expect(await getDatabase().queryOne<{ decision: string }>('SELECT decision FROM provider_rule_reviews WHERE rule_candidate_id = ? ORDER BY created_at DESC LIMIT 1', [candidate!.id])).toEqual({ decision: 'edited' });
  });
});
