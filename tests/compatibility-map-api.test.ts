import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TypeScriptRepositoryAnalyzer, RepositorySnapshot } from '@apiproof/analyzers';
import { StripeProvider } from '@apiproof/providers';
import type { ScanResult } from '@apiproof/shared';
import { GET } from '../apps/web/src/app/api/compatibility-map/route.js';
import { summarizeScanCompatibility } from '../apps/web/src/lib/server/scan-compatibility-evidence.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const DB_PATH = path.resolve('.tmp/compatibility-map-api.db');
const BASELINE = 'a'.repeat(40);
const NOW = '2026-10-02T00:00:00.000Z';
let analyzerResult: ScanResult;

interface CompatibilityMapTestPayload {
  workspaceId: string;
  repositories: Array<{
    id: string;
    latestScanStatus: string;
    latestCompletedScan: { id: string; baselineSha: string | null; filesAnalyzed: number } | null;
    analysisEvidenceAvailable: boolean;
    integrations: Array<{
      provider: string;
      detected: boolean;
      usageCount: number | null;
      mappedSymbolCount: number | null;
      reviewedChangeCount: number;
    }>;
    openFindingCount: number;
    findings: Array<{
      id: string;
      migration: { id: string; status: string | null } | null;
      pullRequest: { id: string; number: number | null; state: string | null } | null;
    }>;
  }>;
}

beforeAll(async () => {
  const snapshot = RepositorySnapshot.fromMemory('/compatibility-map-test', new Map([
    ['package.json', JSON.stringify({ dependencies: { stripe: '^18.0.0' } })],
    ['src/billing.ts', `import Stripe from 'stripe';
const stripe = new Stripe('not-a-real-secret');
export function createSubscription(customer: string, price: string) {
  return stripe.subscriptions.create({ customer, items: [{ price }], coupon: 'legacy' });
}`],
  ]));
  analyzerResult = await new TypeScriptRepositoryAnalyzer().analyze(snapshot, new StripeProvider().descriptor);
});

describe('GET /api/compatibility-map', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'compatibility-map-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  async function createRepository(userId: string, id: string, name: string) {
    const workspace = await getDefaultWorkspaceForUser(userId);
    await getDatabase().execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES (?, ?, ?, 'sample-owner', ?, ?, ?, 'trunk', 'connected', 'connected', 'active', ?)
    `, [id, workspace.id, userId, name, `sample-owner/${name}`, `github-${id}`, NOW]);
    return workspace.id;
  }

  async function createScan(repositoryId: string, id: string, status: string, startedAt: string, rawResult: string | null) {
    await getDatabase().execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, files_analyzed, findings_count, raw_result, started_at, completed_at)
      VALUES (?, ?, ?, ?, 'multi-provider', 4, 1, ?, ?, ?)
    `, [id, repositoryId, BASELINE, status, rawResult, startedAt, status === 'completed' ? startedAt : null]);
  }

  async function addFinding(repositoryId: string, scanId: string, id: string, provider: string, changeId: string, status = 'open') {
    await getDatabase().execute(`
      INSERT INTO findings (
        id, scan_id, repository_id, usage_id, change_id, provider, title, description,
        severity, confidence, file_path, line_number, symbol, status, reason, reason_codes,
        evidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Migration finding', 'Evidence-backed finding', 'high', 0.9,
        'src/billing.ts', 4, 'subscriptions.create', ?, 'matched source evidence', '[]', '[]', ?)
    `, [id, scanId, repositoryId, `usage-${id}`, changeId, provider, status, NOW]);
  }

  async function getMap(sessionId: string) {
    return GET(new Request('http://localhost/api/compatibility-map', {
      headers: { cookie: `apiproof_session=${sessionId}` },
    }));
  }

  it('requires authentication and returns only active repositories in the authenticated default workspace', async () => {
    const first = await createUserWithSession('map-first@example.com', 'Strong-password-1!', 'First User');
    const second = await createUserWithSession('map-second@example.com', 'Strong-password-1!', 'Second User');
    const ownWorkspaceId = await createRepository(first.user.id, 'repo_map_own', 'own-repository');
    await createRepository(second.user.id, 'repo_map_other', 'other-repository');

    const unauthorized = await GET(new Request('http://localhost/api/compatibility-map'));
    expect(unauthorized.status).toBe(401);

    const response = await getMap(first.session.id);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json() as CompatibilityMapTestPayload;
    expect(body.workspaceId).toBe(ownWorkspaceId);
    expect(body.repositories.map((repository: { id: string }) => repository.id)).toEqual(['repo_map_own']);
    expect(JSON.stringify(body)).not.toContain('Bavio-Ai-v1');
    expect(JSON.stringify(body)).not.toContain('apiproof-github-fixture');
  });

  it('selects the latest completed scan and never treats a newer failed scan as the compatibility baseline', async () => {
    const user = await createUserWithSession('map-scan@example.com', 'Strong-password-1!', 'Scan User');
    await createRepository(user.user.id, 'repo_map_scans', 'scan-repository');
    const oldSummary = JSON.stringify({ schemaVersion: 1, providers: [{ provider: 'stripe', detected: true, usageCount: 2, mappedSymbolCount: 1 }] });
    const latestSummary = JSON.stringify({ schemaVersion: 1, providers: [{ provider: 'stripe', detected: true, usageCount: 8, mappedSymbolCount: 3 }] });
    await createScan('repo_map_scans', 'scan_old_completed', 'completed', '2026-10-01T00:00:00.000Z', oldSummary);
    await createScan('repo_map_scans', 'scan_latest_completed', 'completed', '2026-10-01T12:00:00.000Z', latestSummary);
    await createScan('repo_map_scans', 'scan_latest_failed', 'failed', '2026-10-02T00:00:00.000Z', null);

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(repository.latestScanStatus).toBe('failed');
    expect(repository.latestCompletedScan?.id).toBe('scan_latest_completed');
    expect(repository.latestCompletedScan?.baselineSha).toBe(BASELINE);
    expect(repository.latestCompletedScan?.filesAnalyzed).toBe(4);
    expect(repository.integrations[0]).toMatchObject({ usageCount: 8, mappedSymbolCount: 3 });

    await createScan('repo_map_scans', 'scan_newer_running', 'running', '2026-10-02T01:00:00.000Z',
      JSON.stringify({ schemaVersion: 1, providers: [{ provider: 'stripe', detected: true, usageCount: 99, mappedSymbolCount: 99 }] }));
    const runningResponse = await getMap(user.session.id);
    const runningRepository = (await runningResponse.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(runningRepository.latestScanStatus).toBe('running');
    expect(runningRepository.latestCompletedScan?.id).toBe('scan_latest_completed');
    expect(runningRepository.integrations[0]!.usageCount).toBe(8);
  });

  it('returns provider and usage counts derived from actual analyzer output', async () => {
    const user = await createUserWithSession('map-analyzer@example.com', 'Strong-password-1!', 'Analyzer User');
    await createRepository(user.user.id, 'repo_map_analyzed', 'analyzed-repository');
    const rawResult = JSON.stringify(summarizeScanCompatibility([analyzerResult]));
    await createScan('repo_map_analyzed', 'scan_real_analysis', 'completed', NOW, rawResult);

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(analyzerResult.providerUsed).toBe(true);
    expect(analyzerResult.usages.length).toBeGreaterThan(0);
    expect(repository.analysisEvidenceAvailable).toBe(true);
    expect(repository.integrations).toEqual([{
      provider: 'stripe',
      detected: true,
      usageCount: analyzerResult.usages.length,
      mappedSymbolCount: new Set(analyzerResult.usages.filter((usage) => usage.kind !== 'import').map((usage) => usage.symbol)).size,
      reviewedChangeCount: 0,
    }]);
  });

  it('associates findings, migration status, and Draft PR state through their real database relationships', async () => {
    const user = await createUserWithSession('map-state@example.com', 'Strong-password-1!', 'State User');
    await createRepository(user.user.id, 'repo_map_state', 'state-repository');
    const summary = JSON.stringify({ schemaVersion: 1, providers: [{ provider: 'stripe', detected: true, usageCount: 1, mappedSymbolCount: 1 }] });
    await createScan('repo_map_state', 'scan_state', 'completed', NOW, summary);
    await addFinding('repo_map_state', 'scan_state', 'finding_state', 'stripe', 'not-a-reviewed-registry-change');
    await getDatabase().execute(`
      INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, created_at)
      VALUES ('migration_state', 'finding_state', 'repo_map_state', 'plan_state', 'verified', '{}', ?)
    `, [NOW]);
    await getDatabase().execute(`
      INSERT INTO pull_requests (id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at)
      VALUES ('pr_state', 'migration_state', 'repo_map_state', 17, 'Review migration', 'apiproof/test', 'trunk', 'https://github.com/sample-owner/state-repository/pull/17', 'draft', ?)
    `, [NOW]);

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(repository.openFindingCount).toBe(1);
    expect(repository.integrations[0]!.reviewedChangeCount).toBe(0);
    expect(repository.findings[0]).toMatchObject({
      id: 'finding_state',
      migration: { id: 'migration_state', status: 'verified' },
      pullRequest: { id: 'pr_state', number: 17, state: 'draft' },
    });
  });

  it('marks an integration reviewed only when its matched registry change has review metadata', async () => {
    const user = await createUserWithSession('map-reviewed@example.com', 'Strong-password-1!', 'Reviewed User');
    await createRepository(user.user.id, 'repo_map_reviewed', 'reviewed-repository');
    const summary = JSON.stringify({ schemaVersion: 1, providers: [{ provider: 'stripe', detected: true, usageCount: 1, mappedSymbolCount: 1 }] });
    await createScan('repo_map_reviewed', 'scan_reviewed', 'completed', NOW, summary);
    await addFinding('repo_map_reviewed', 'scan_reviewed', 'finding_reviewed', 'stripe', 'stripe-subscription-coupon-removed');

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(repository.integrations[0]!.reviewedChangeCount).toBe(1);
  });

  it('keeps empty, unscanned, and no-integration states distinct', async () => {
    const user = await createUserWithSession('map-empty@example.com', 'Strong-password-1!', 'Empty User');
    const emptyResponse = await getMap(user.session.id);
    expect((await emptyResponse.json() as CompatibilityMapTestPayload).repositories).toEqual([]);

    await createRepository(user.user.id, 'repo_map_unscanned', 'unscanned-repository');
    const unscannedResponse = await getMap(user.session.id);
    const unscanned = (await unscannedResponse.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(unscanned.latestCompletedScan).toBeNull();
    expect(unscanned.latestScanStatus).toBe('not_scanned');

    await createScan('repo_map_unscanned', 'scan_no_provider', 'completed', NOW, JSON.stringify({
      schemaVersion: 1,
      providers: [{ provider: 'stripe', detected: false, usageCount: 0, mappedSymbolCount: 0 }],
    }));
    const scannedResponse = await getMap(user.session.id);
    const scanned = (await scannedResponse.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(scanned.analysisEvidenceAvailable).toBe(true);
    expect(scanned.integrations).toEqual([]);
  });

  it('does not infer usage counts or symbol mapping for legacy evidence or provider names', async () => {
    const user = await createUserWithSession('map-legacy@example.com', 'Strong-password-1!', 'Legacy User');
    await createRepository(user.user.id, 'repo_map_legacy', 'legacy-repository');
    await createScan('repo_map_legacy', 'scan_legacy', 'completed', NOW, null);
    await addFinding('repo_map_legacy', 'scan_legacy', 'finding_legacy', 'stripe', 'unknown-change');

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(repository.analysisEvidenceAvailable).toBe(false);
    expect(repository.integrations).toEqual([{
      provider: 'stripe',
      detected: true,
      usageCount: null,
      mappedSymbolCount: null,
      reviewedChangeCount: 0,
    }]);
  });

  it('reports no mapped symbols when analyzer evidence has no mapped symbol usages', async () => {
    const user = await createUserWithSession('map-no-symbols@example.com', 'Strong-password-1!', 'No Symbols User');
    await createRepository(user.user.id, 'repo_map_no_symbols', 'no-symbols-repository');
    await createScan('repo_map_no_symbols', 'scan_no_symbols', 'completed', NOW, JSON.stringify({
      schemaVersion: 1,
      providers: [{ provider: 'stripe', detected: true, usageCount: 0, mappedSymbolCount: 0 }],
    }));

    const response = await getMap(user.session.id);
    const repository = (await response.json() as CompatibilityMapTestPayload).repositories[0]!;
    expect(repository.integrations[0]!.mappedSymbolCount).toBe(0);
  });
});
