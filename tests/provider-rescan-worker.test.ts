import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type * as GitHubModule from '../apps/web/src/lib/server/github.js';
import type * as CoreModule from '@apiproof/core';
import * as AnalyzerModule from '@apiproof/analyzers';

vi.mock('../apps/web/src/lib/server/github.js', async (importOriginal) => ({
  ...(await importOriginal<typeof GitHubModule>()),
  fetchRemoteRepositoryFiles: vi.fn(),
}));
vi.mock('@apiproof/core', async (importOriginal) => ({
  ...(await importOriginal<typeof CoreModule>()),
  NodeGitHubAppTokenProvider: vi.fn(function (this: object) { Object.assign(this, { getInstallationToken: vi.fn().mockResolvedValue('github-token-fixture') }); }),
  GitHubAppSourceControlProvider: vi.fn(function (this: object) { Object.assign(this, { getDefaultBranch: vi.fn().mockResolvedValue({ name: 'main', sha: 'd'.repeat(40) }) }); }),
  loadGitHubAppConfig: vi.fn().mockReturnValue({ enabled: true, appId: '12345', appSlug: 'apiproof-test', privateKey: 'private-key-fixture' }),
}));

import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';
import { enqueueProviderSourceChangeRescans, processRepositoryRescans } from '../apps/web/src/lib/server/repository-rescan-worker.js';
import { approveProviderRuleCandidate } from '../apps/web/src/lib/server/provider-rule-service.js';
import { loadActiveProductionRegistry } from '../apps/web/src/lib/server/registry-utils.js';
import { PROVIDER_CHANGE_SOURCES, refreshProviderChangelog } from '../apps/web/src/lib/server/provider-change-monitor.js';

const reviewEvidence = (affected: string, unaffected: string) => ({
  cases: [
    { kind: 'affected', filePath: 'review/affected.ts', code: affected, rationale: 'The reviewed token is present in the affected usage.' },
    { kind: 'unaffected', filePath: 'review/unaffected.ts', code: unaffected, rationale: 'The reviewed token is absent from this unaffected usage.' },
    { kind: 'uncertain', filePath: 'review/uncertain.ts', code: 'const value = maybeDynamicInput;', rationale: 'This usage requires human follow-up because its meaning is ambiguous.' },
  ],
});

const DB_PATH = path.resolve('.tmp/test-provider-rescan-worker.db');
const randomId = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
const resolvePublicHost = async (_hostname: string, _options: { all: true; verbatim: true }): Promise<readonly { address: string }[]> => [{ address: '93.184.216.34' }];

describe('provider rescan worker orchestration', () => {
  beforeEach(async () => {
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.GITHUB_APP_ID = '12345';
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    process.env.GITHUB_APP_SLUG = 'apiproof-test';
    process.env.GITHUB_APP_PRIVATE_KEY = 'private-key-fixture';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
    vi.mocked(fetchRemoteRepositoryFiles).mockResolvedValue({
      files: new Map([['package.json', '{"dependencies":{}}']]), headSha: 'd'.repeat(40), defaultBranch: 'main',
    });
  });
  afterEach(() => {
    closeDatabase();
    delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    vi.clearAllMocks();
  });

  it('runs the scan worker immediately when an approved provider rule queues a rescan', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('approved-rule@example.com', 'Pass1234!', 'Test User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '1234567', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', 'test-repo', 'test-org/test-repo', '7654321', 'main', 'connected', ?)`, [repoId, workspace.id, user.id, now]);
    const sha = 'b'.repeat(40);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [randomId('scan'), repoId, sha, now, now]);
    const sourceId = randomId('source');
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', 'https://platform.openai.com/docs/deprecations', 'official-changelog', 'openai', ?, ?)`, [sourceId, now, now]);
    const entryId = randomId('entry');
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'approved-rule-entry', 'Approved rule', 'Approved rule test entry', 'test', 'https://platform.openai.com/docs/deprecations', ?, '{}', ?, ?)`, [entryId, sourceId, 'c'.repeat(64), now, now]);
    const candidateId = randomId('candidate');
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, payload_json, created_at, updated_at) VALUES (?, ?, 'openai', ?, '{}', ?, ?)`, [candidateId, entryId, randomId('fingerprint'), now, now]);
    await db.execute(`INSERT INTO provider_rescan_jobs (id, workspace_id, repository_id, rule_candidate_id, reason, created_at, updated_at) VALUES (?, ?, ?, ?, 'new_rule_approved', ?, ?)`, [randomId('provider-job'), workspace.id, repoId, candidateId, now, now]);

    const result = await processRepositoryRescans({ batchSize: 1 });
    expect(result.jobsQueued).toBe(1);
    expect(result.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
    expect(await db.queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed' });
    expect(await db.queryOne<{ status: string; commit_sha: string }>('SELECT status, commit_sha FROM github_scan_requests WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed', commit_sha: 'd'.repeat(40) });
  });

  it('processes provider-change rescans immediately without consuming nightly jobs', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('provider-route-scope@example.com', 'Pass1234!', 'Provider Route Scope');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '12345670', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', 'provider-route-repo', 'test-org/provider-route-repo', '7654330', 'main', 'connected', 'active', ?)`, [repoId, workspace.id, user.id, now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [randomId('scan'), repoId, 'b'.repeat(40), now, now]);
    const candidateId = randomId('candidate');
    const sourceId = randomId('source');
    const entryId = randomId('entry');
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', 'https://platform.openai.com/docs/deprecations', 'official-changelog', 'openai', ?, ?)`, [sourceId, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'provider-route-change', 'Provider route change', 'Provider route change test', 'test', 'https://platform.openai.com/docs/deprecations', ?, '{}', ?, ?)`, [entryId, sourceId, 'c'.repeat(64), now, now]);
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, payload_json, created_at, updated_at) VALUES (?, ?, 'openai', ?, '{}', ?, ?)`, [candidateId, entryId, randomId('fingerprint'), now, now]);
    await db.execute(`INSERT INTO provider_rescan_jobs (id, workspace_id, repository_id, rule_candidate_id, reason, created_at, updated_at) VALUES (?, ?, ?, ?, 'provider_source_changed', ?, ?)`, [randomId('provider-job'), workspace.id, repoId, candidateId, now, now]);
    await db.execute(`INSERT INTO repository_rescan_jobs (id, workspace_id, repository_id, reason, created_at, updated_at) VALUES (?, ?, ?, 'nightly_rescan', ?, ?)`, [randomId('nightly-job'), workspace.id, repoId, now, now]);

    const result = await processRepositoryRescans({ batchSize: 1, includeScheduled: false });

    expect(result.jobsQueued).toBe(1);
    expect(await db.queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed' });
    expect(await db.queryOne<{ status: string }>('SELECT status FROM repository_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'pending' });
  });

  it('executes a repository-level provider-change fallback job through the scan worker', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('repository-fallback@example.com', 'Pass1234!', 'Repository Fallback');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '12345672', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', 'fallback-repo', 'test-org/fallback-repo', '7654331', 'main', 'connected', 'active', ?)`, [repoId, workspace.id, user.id, now]);
    const scanId = randomId('scan');
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repoId, 'b'.repeat(40), now, now]);
    await db.execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, ?, ?)`, [repoId, workspace.id, scanId, now, now, now]);
    await db.execute(`INSERT INTO repository_rescan_jobs (id, workspace_id, repository_id, reason, created_at, updated_at) VALUES (?, ?, ?, 'provider_source_changed', ?, ?)`, [randomId('repository-job'), workspace.id, repoId, now, now]);

    const result = await processRepositoryRescans({ batchSize: 1, includeScheduled: false });

    expect(result.jobsQueued).toBe(1);
    expect(result.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
    expect(await db.queryOne<{ status: string }>('SELECT status FROM repository_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed' });
    expect(await db.queryOne<{ status: string; commit_sha: string }>('SELECT status, commit_sha FROM github_scan_requests WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed', commit_sha: 'd'.repeat(40) });
  });

  it('requeues completed approved-rule jobs when an authoritative provider source changes', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('provider-source-change@example.com', 'Pass1234!', 'Provider Source Change');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', 'source-change-repo', 'test-org/source-change-repo', '7654328', 'main', 'connected', 'active', ?)`, [repoId, workspace.id, user.id, now]);
    const scanId = randomId('scan');
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repoId, 'a'.repeat(40), now, now]);
    await db.execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, 'openai', ?, ?, ?, ?)`, [repoId, workspace.id, scanId, now, now, now]);
    const sourceId = randomId('source');
    const entryId = randomId('entry');
    const candidateId = randomId('candidate');
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', 'https://platform.openai.com/docs/deprecations', 'official-changelog', 'openai', ?, ?)`, [sourceId, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'approved-rule-entry', 'Approved rule', 'Approved rule test entry', 'test', 'https://platform.openai.com/docs/deprecations', ?, '{}', ?, ?)`, [entryId, sourceId, 'c'.repeat(64), now, now]);
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, status, payload_json, created_at, updated_at) VALUES (?, ?, 'openai', ?, 'approved', '{}', ?, ?)`, [candidateId, entryId, randomId('fingerprint'), now, now]);
    await db.execute(`INSERT INTO provider_rescan_jobs (id, workspace_id, repository_id, rule_candidate_id, reason, status, attempt_count, created_at, updated_at) VALUES (?, ?, ?, ?, 'new_rule_approved', 'completed', 5, ?, ?)`, [randomId('provider-job'), workspace.id, repoId, candidateId, now, now]);

    const queued = await db.transaction((tx) => enqueueProviderSourceChangeRescans(tx, 'openai', new Date('2027-01-01T07:00:00.000Z').toISOString()));
    expect(queued).toBe(1);
    expect(await db.queryOne<{ reason: string; status: string; attempt_count: number; scan_request_id: string | null }>('SELECT reason, status, attempt_count, scan_request_id FROM provider_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ reason: 'provider_source_changed', status: 'pending', attempt_count: 0, scan_request_id: null });

    const secondPass = await db.transaction((tx) => enqueueProviderSourceChangeRescans(tx, 'openai', new Date('2027-01-01T08:00:00.000Z').toISOString()));
    expect(secondPass).toBe(0);
  });

  it('routes an approved rule to indexed provider repositories without fanning out to known unrelated repositories', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('indexed-routing@example.com', 'Pass1234!', 'Indexed Routing');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const now = new Date().toISOString();
    const matchingRepoId = randomId('repo-openai');
    const unrelatedRepoId = randomId('repo-stripe');
    for (const [repositoryId, name, providerId] of [[matchingRepoId, 'openai-repo', 'openai'], [unrelatedRepoId, 'stripe-repo', 'stripe']] as const) {
      await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', ?, ?, ?, 'main', 'connected', 'active', ?)`, [repositoryId, workspace.id, user.id, name, `test-org/${name}`, randomId('github'), now]);
      const scanId = randomId('scan');
      await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repositoryId, 'a'.repeat(40), now, now]);
      await db.execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [repositoryId, workspace.id, providerId, scanId, now, now, now]);
    }
    const sourceId = randomId('source');
    const entryId = randomId('entry');
    const candidateId = randomId('candidate');
    const sourceUrl = 'https://platform.openai.com/docs/deprecations';
    const payload = {
      changeId: `indexed-openai-${candidateId}`,
      title: 'OpenAI old model retirement',
      description: 'The reviewed old-model identifier is retired; migrate to new-model.',
      changeType: 'model_retired',
      applicabilityScope: { dimensions: ['provider', 'package', 'model'] },
      affectedPackages: ['openai'],
      affectedModels: ['old-model'],
      apiOperationPatterns: [],
      affectedParameters: [],
      affectedResponseFields: [],
      affectedEndpoints: [],
      affectedResources: [],
      replacement: { model: 'new-model' },
      severity: 'high',
      sourceFacts: ['The official notice retires old-model and names new-model as the replacement.'],
    };
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', ?, 'official-changelog', 'openai', ?, ?)`, [sourceId, sourceUrl, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'indexed-routing-entry', 'OpenAI retirement', 'OpenAI retirement', 'test', ?, ?, '{}', ?, ?)`, [entryId, sourceId, sourceUrl, 'd'.repeat(64), now, now]);
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at) VALUES (?, ?, 'openai', ?, 'needs_review', 'high', ?, ?, ?)`, [candidateId, entryId, randomId('fingerprint'), JSON.stringify(payload), now, now]);

    const approval = await approveProviderRuleCandidate(candidateId, user.id, 'Confirmed the official retirement notice and replacement.', workspace.id, reviewEvidence("client.chat.completions.create({ model: 'old-model' })", "client.chat.completions.create({ model: 'current-model' })"));
    expect(approval.repositoriesQueued).toBe(1);
    expect(await db.query<{ repository_id: string }>('SELECT repository_id FROM provider_rescan_jobs WHERE rule_candidate_id = ?', [candidateId])).toEqual([{ repository_id: matchingRepoId }]);
  });

  it('propagates a detected API-version retirement through approval, exact-commit rescan, and finding creation', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('api-version-rescan@example.com', 'Pass1234!', 'API Version Rescan');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '12345671', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', 'shopify-version-repo', 'test-org/shopify-version-repo', '7654324', 'main', 'connected', ?)`, [repoId, workspace.id, user.id, now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [randomId('scan'), repoId, 'a'.repeat(40), now, now]);

    const source = PROVIDER_CHANGE_SOURCES.find((candidate) => candidate.providerId === 'shopify');
    expect(source).toBeDefined();
    let changed = false;
    const fetchImpl = async (): Promise<Response> => new Response(
      changed ? '<p>2027-01-01 breaking change: the <code>2027-10</code> Admin API version is removed</p>' : '<p>Shopify release notes baseline</p>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    await refreshProviderChangelog('shopify', { fetchImpl, resolveHost: resolvePublicHost, now: () => new Date('2027-01-01T00:00:00.000Z') });
    changed = true;
    const detected = await refreshProviderChangelog('shopify', { fetchImpl, resolveHost: resolvePublicHost, now: () => new Date('2027-01-01T07:00:00.000Z') });
    expect(detected.status).toBe('changed');

    const candidate = await db.queryOne<{ id: string; payload_json: string }>(`SELECT id, payload_json FROM provider_rule_candidates WHERE provider_id = 'shopify' ORDER BY created_at DESC LIMIT 1`);
    expect(candidate).toBeDefined();
    const payload = JSON.parse(candidate!.payload_json) as { changeType: string; apiVersionMetadata?: { version?: string }; applicabilityScope?: { dimensions?: string[] } };
    expect(payload).toMatchObject({ changeType: 'api_version_retired', apiVersionMetadata: { version: '2027-10' }, applicabilityScope: { dimensions: ['provider', 'api_version'] } });

    const approval = await approveProviderRuleCandidate(
      candidate!.id,
      user.id,
      'Confirmed the official Shopify API-version retirement and migration path.',
      workspace.id,
      reviewEvidence("const client = shopifyApi({ apiVersion: '2027-10' });", "const client = shopifyApi({ apiVersion: '2026-01' });"),
    );
    expect(approval.repositoriesQueued).toBe(1);

    const sha = 'd'.repeat(40);
    vi.mocked(fetchRemoteRepositoryFiles).mockResolvedValue({
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { '@shopify/shopify-api': '11.0.0' } })],
        ['src/shopify.ts', "import { shopifyApi } from '@shopify/shopify-api'; const client = shopifyApi({ apiVersion: '2027-10' });"],
      ]),
      headSha: sha,
      defaultBranch: 'main',
    });

    const result = await processRepositoryRescans({ batchSize: 1 });
    expect(result.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
    const scan = await db.queryOne<{ status: string; findings_count: number; raw_result: string; sha: string }>('SELECT status, findings_count, raw_result, sha FROM scans WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1', [repoId]);
    expect(scan).toMatchObject({ status: 'completed', sha });
    expect(scan?.findings_count).toBeGreaterThan(0);
    expect(scan?.raw_result).toContain(payload.apiVersionMetadata!.version!);
    expect(scan?.raw_result).toContain('AFFECTED');
    expect(await db.queryOne<{ change_id: string; status: string }>('SELECT change_id, status FROM findings WHERE repository_id = ?', [repoId])).toEqual({ change_id: JSON.parse(candidate!.payload_json).changeId, status: 'open' });
    expect(await db.queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed' });
  });

  it('proves source approval through workspace registry, rescan, and durable affected finding', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('automation-proof@example.com', 'Pass1234!', 'Automation Proof');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '1234568', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', 'automation-repo', 'test-org/automation-repo', '7654322', 'main', 'connected', ?)`, [repoId, workspace.id, user.id, now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [randomId('scan'), repoId, 'b'.repeat(40), now, now]);

    const sourceId = randomId('source');
    const entryId = randomId('entry');
    const candidateId = randomId('candidate');
    const sourceUrl = 'https://platform.openai.com/docs/deprecations';
    const payload = {
      changeId: `automation-openai-${candidateId}`,
      title: 'OpenAI old-model retirement',
      description: 'The reviewed old-model identifier is retired; migrate to new-model.',
      changeType: 'model_retired',
      publishedAt: '2026-10-01',
      removalAt: '2027-01-01',
      applicabilityScope: { dimensions: ['provider', 'package', 'model'] },
      affectedPackages: ['openai'],
      affectedModels: ['old-model'],
      apiOperationPatterns: [],
      affectedParameters: [],
      affectedResponseFields: [],
      affectedEndpoints: [],
      affectedResources: [],
      replacement: { model: 'new-model' },
      severity: 'high',
      sourceFacts: ['The official notice retires old-model and names new-model as the replacement.'],
    };
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', ?, 'official-changelog', 'openai', ?, ?)`, [sourceId, sourceUrl, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'automation-proof-entry', 'OpenAI retirement', 'OpenAI retirement', 'test', ?, ?, '{}', ?, ?)`, [entryId, sourceId, sourceUrl, 'c'.repeat(64), now, now]);
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at) VALUES (?, ?, 'openai', ?, 'needs_review', 'high', ?, ?, ?)`, [candidateId, entryId, randomId('fingerprint'), JSON.stringify(payload), now, now]);

    const beforeApproval = await loadActiveProductionRegistry(workspace.id);
    expect(beforeApproval.changes.some((change) => change.changeId === payload.changeId)).toBe(false);

    const approval = await approveProviderRuleCandidate(candidateId, user.id, 'Confirmed the official retirement notice and replacement.', workspace.id, reviewEvidence("client.chat.completions.create({ model: 'old-model' })", "client.chat.completions.create({ model: 'current-model' })"));
    expect(approval.repositoriesQueued).toBe(1);
    const approvedRegistry = await loadActiveProductionRegistry(workspace.id);
    expect(approvedRegistry.changes.some((change) => change.changeId === payload.changeId)).toBe(true);

    const sha = 'd'.repeat(40);
    vi.mocked(fetchRemoteRepositoryFiles).mockResolvedValueOnce({
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
        ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'old-model', messages: [] });"],
      ]),
      headSha: sha,
      defaultBranch: 'main',
    });

    const result = await processRepositoryRescans({ batchSize: 1 });
    expect(result.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
    const scan = await db.queryOne<{ status: string; findings_count: number; raw_result: string; sha: string }>('SELECT status, findings_count, raw_result, sha FROM scans WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1', [repoId]);
    expect(scan?.status).toBe('completed');
    expect(scan?.sha).toBe(sha);
    expect(scan?.findings_count).toBeGreaterThan(0);
    expect(scan?.raw_result).toContain(payload.changeId);
    expect(scan?.raw_result).toContain('AFFECTED');
    expect(await db.queryOne<{ change_id: string; status: string }>('SELECT change_id, status FROM findings WHERE repository_id = ?', [repoId])).toEqual({ change_id: payload.changeId, status: 'open' });
    expect(await db.queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs WHERE repository_id = ?', [repoId])).toEqual({ status: 'completed' });

    expect(vi.isMockFunction(AnalyzerModule.runProductizationScan)).toBe(false);
  });

  it('keeps approved dynamic rules out of the worker when the rollout flag is disabled', async () => {
    const db = getDatabase();
    const { user } = await createUserWithSession('rollback-boundary@example.com', 'Pass1234!', 'Rollback Boundary');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repoId = randomId('repo');
    const now = new Date().toISOString();
    await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, '1234569', 'test-org', 'Organization', 'active', ?, ?)`, [randomId('installation'), workspace.id, now, now]);
    await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', 'rollback-repo', 'test-org/rollback-repo', '7654323', 'main', 'connected', ?)`, [repoId, workspace.id, user.id, now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [randomId('scan'), repoId, 'e'.repeat(40), now, now]);
    const sourceId = randomId('source');
    const entryId = randomId('entry');
    const candidateId = randomId('candidate');
    const payload = { changeId: `rollback-openai-${candidateId}`, title: 'Rollback test', description: 'Rollback test model retirement.', changeType: 'model_retired', applicabilityScope: { dimensions: ['provider', 'package', 'model'] }, affectedPackages: ['openai'], affectedModels: ['rollback-model'], sourceFacts: ['Official rollback test fact.'], severity: 'high' };
    await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'openai', 'https://platform.openai.com/docs/deprecations', 'official-changelog', 'openai', ?, ?)`, [sourceId, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'openai', 'rollback-entry', 'Rollback', 'Rollback', 'test', 'https://platform.openai.com/docs/deprecations', ?, '{}', ?, ?)`, [entryId, sourceId, 'f'.repeat(64), now, now]);
    await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at, workspace_id, reviewed_by, reviewed_at, review_notes) VALUES (?, ?, 'openai', ?, 'approved', 'high', ?, ?, ?, ?, ?, ?, ?)`, [candidateId, entryId, randomId('fingerprint'), JSON.stringify(payload), now, now, workspace.id, user.id, now, 'approved for rollback test']);
    await db.execute(`INSERT INTO provider_rescan_jobs (id, workspace_id, repository_id, rule_candidate_id, reason, created_at, updated_at) VALUES (?, ?, ?, ?, 'new_rule_approved', ?, ?)`, [randomId('provider-job'), workspace.id, repoId, candidateId, now, now]);
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'false';
    const sha = 'd'.repeat(40);
    vi.mocked(fetchRemoteRepositoryFiles).mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
      ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'rollback-model', messages: [] });"],
    ]) });
    const result = await processRepositoryRescans({ batchSize: 1 });
    expect(result.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
    const scan = await db.queryOne<{ findings_count: number; raw_result: string }>('SELECT findings_count, raw_result FROM scans WHERE repository_id = ?', [repoId]);
    expect(scan?.findings_count).toBe(0);
    expect(scan?.raw_result ?? '').not.toContain(payload.changeId);
  });
});
