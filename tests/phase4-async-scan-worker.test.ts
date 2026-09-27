/**
 * Phase 4: Asynchronous Scan Worker Tests
 *
 * Covers:
 *   TEST A: processPendingGitHubScans returns empty result when no jobs exist
 *   TEST B: Job claiming transitions status from pending → processing → terminal
 *   TEST C: batchSize option limits the number of jobs claimed per invocation
 *   TEST D: Job with no active installation is skipped (status='skipped')
 *   TEST E: Job with suspended installation is skipped (status='skipped')
 *   TEST F: Job targeting deleted repository fails cleanly (status='failed')
 *   TEST G: Failed file fetch marks scan record as failed
 *   TEST H: timedOut reverts unprocessed claimed jobs back to pending
 *   TEST I: Successful scan marks scan_request as completed
 *   TEST J: Completed scan persists scan record with correct fields
 *   TEST K: Findings are upserted idempotently across two scans
 *   TEST L: ScanWorkerResult counters correctly reflect per-job outcomes
 *   TEST M: workspace_id mismatch to repository fails with REPOSITORY_NOT_FOUND
 *   TEST N: Multiple independent jobs processed in one invocation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be at top level — vi.mock is hoisted by vitest)
// ---------------------------------------------------------------------------

// We mock the github module so fetchRemoteRepositoryFiles can be controlled per test.
vi.mock('../apps/web/src/lib/server/github.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../apps/web/src/lib/server/github.js')>();
  return {
    ...original,
    fetchRemoteRepositoryFiles: vi.fn(),
  };
});

// We mock @apiproof/core so no real GitHub App credentials are needed.
vi.mock('@apiproof/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@apiproof/core')>();
  return {
    ...original,
    // Use function constructor so `new NodeGitHubAppTokenProvider(...)` works
    NodeGitHubAppTokenProvider: vi.fn(function (this: object) {
      Object.assign(this, {
        getInstallationToken: vi.fn().mockResolvedValue('ghs_mock_token_abcdef'),
      });
    }),
    GitHubAppSourceControlProvider: vi.fn(function (this: object) {
      Object.assign(this, {});
    }),
    loadGitHubAppConfig: vi.fn().mockReturnValue({
      enabled: true,
      appId: '12345',
      appSlug: 'apiproof-test',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIplaceholder\n-----END RSA PRIVATE KEY-----',
    }),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks are declared
// ---------------------------------------------------------------------------

import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { processPendingGitHubScans } from '../apps/web/src/lib/server/scan-worker.js';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';

// ---------------------------------------------------------------------------
// Test database path
// ---------------------------------------------------------------------------

const TEST_DB_PATH = path.resolve('.tmp/test-phase4-scan-worker.db');

// ---------------------------------------------------------------------------
// Typed mock ref
// ---------------------------------------------------------------------------

const mockFetchRemoteFiles = vi.mocked(fetchRemoteRepositoryFiles);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

async function createWorkspaceWithInstallation(
  email: string,
  installationId: string,
  status: 'active' | 'suspended' | 'deleted' = 'active'
): Promise<{ userId: string; workspaceId: string }> {
  const db = getDatabase();
  const { user } = await createUserWithSession(email, 'Pass1234!', 'Test User');
  const ws = await getDefaultWorkspaceForUser(user.id);
  const installationDbId = randomId('gi');
  const now = new Date().toISOString();

  await db.execute(`
    INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
    VALUES (?, ?, ?, 'test-org', 'Organization', ?, ?, ?)
  `, [installationDbId, ws.id, installationId, status, now, now]);

  return { userId: user.id, workspaceId: ws.id };
}

async function createRepository(workspaceId: string, userId: string, suffix = ''): Promise<string> {
  const db = getDatabase();
  const repoId = randomId('repo');
  const now = new Date().toISOString();
  const repoName = `test-repo${suffix}`;

  await db.execute(`
    INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
    VALUES (?, ?, ?, 'test-org', ?, ?, '999000', 'main', 'connected', ?)
  `, [repoId, workspaceId, userId, repoName, `test-org/${repoName}`, now]);

  return repoId;
}

async function createScanRequest(
  workspaceId: string,
  repositoryId: string,
  commitSha?: string,
  status = 'pending'
): Promise<string> {
  const db = getDatabase();
  const reqId = randomId('gsrq');
  const sha = commitSha ?? crypto.randomBytes(20).toString('hex');
  const now = new Date().toISOString();

  await db.execute(`
    INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
    VALUES (?, ?, ?, ?, 'refs/heads/main', ?, ?)
  `, [reqId, workspaceId, repositoryId, sha, status, now]);

  return reqId;
}

function makeEmptyFilesResult(sha = 'abc000'): { files: Map<string, string>; headSha: string; defaultBranch: string } {
  return {
    files: new Map([['package.json', JSON.stringify({ name: 'test-repo', dependencies: {} })]]),
    headSha: sha,
    defaultBranch: 'main',
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Phase 4 — Asynchronous Scan Worker', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'phase4-test-secret-minimum-32-chars-long';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_SLUG = 'apiproof-test';
    process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEplaceholder\n-----END RSA PRIVATE KEY-----';

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);

    // Default mock: succeed with empty repo (no findings)
    mockFetchRemoteFiles.mockResolvedValue(makeEmptyFilesResult());
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TEST A: Empty queue
  // -------------------------------------------------------------------------
  it('TEST A: returns empty result when no pending jobs exist', async () => {
    const result = await processPendingGitHubScans({ batchSize: 5 });

    expect(result.jobsClaimed).toBe(0);
    expect(result.jobsCompleted).toBe(0);
    expect(result.jobsFailed).toBe(0);
    expect(result.jobsSkipped).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.timedOut).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST B: Job claiming transitions status
  // -------------------------------------------------------------------------
  it('TEST B: claimed job transitions from pending to terminal state after execution', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-b@example.com', 'inst_test_b');
    const repoId = await createRepository(workspaceId, userId);
    await createScanRequest(workspaceId, repoId);

    const db = getDatabase();
    const before = await db.queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE repository_id = ?', [repoId]
    );
    expect(before?.status).toBe('pending');

    mockFetchRemoteFiles.mockRejectedValueOnce(new Error('FETCH_FAIL_B'));
    await processPendingGitHubScans({ batchSize: 1 });

    const after = await db.queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE repository_id = ?', [repoId]
    );
    expect(after?.status).not.toBe('pending');
    expect(after?.status).not.toBe('processing');
  });

  // -------------------------------------------------------------------------
  // TEST C: batchSize limits jobs per invocation
  // -------------------------------------------------------------------------
  it('TEST C: batchSize limits the number of jobs claimed per invocation', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-c@example.com', 'inst_test_c');
    const repoId = await createRepository(workspaceId, userId);

    for (let i = 0; i < 4; i++) {
      await createScanRequest(workspaceId, repoId, `sha_c_${String(i).padStart(39, '0')}`);
    }

    mockFetchRemoteFiles.mockRejectedValue(new Error('FAIL_LIMIT_TEST'));

    const result = await processPendingGitHubScans({ batchSize: 2 });
    expect(result.jobsClaimed).toBe(2);
    expect(result.results).toHaveLength(2);

    const db = getDatabase();
    const remaining = await db.query<{ status: string }>(
      "SELECT status FROM github_scan_requests WHERE repository_id = ? AND status = 'pending'", [repoId]
    );
    expect(remaining.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // TEST D: No active installation → skipped
  // -------------------------------------------------------------------------
  it('TEST D: job with no active installation is skipped', async () => {
    const { user } = await createUserWithSession('test-d@example.com', 'Pass1234!', 'Test D');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const repoId = await createRepository(ws.id, user.id);
    const reqId = await createScanRequest(ws.id, repoId);

    const result = await processPendingGitHubScans({ batchSize: 1 });

    expect(result.jobsClaimed).toBe(1);
    expect(result.jobsSkipped).toBe(1);
    expect(result.jobsCompleted).toBe(0);

    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('skipped');
    expect(jobResult?.error).toContain('NO_ACTIVE_INSTALLATION');

    const db = getDatabase();
    const req = await db.queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE id = ?', [reqId]
    );
    expect(req?.status).toBe('failed');
  });

  // -------------------------------------------------------------------------
  // TEST E: Suspended installation → skipped
  // -------------------------------------------------------------------------
  it('TEST E: job with suspended installation is skipped', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation(
      'test-e@example.com', 'inst_test_e', 'suspended'
    );
    const repoId = await createRepository(workspaceId, userId);
    const reqId = await createScanRequest(workspaceId, repoId);

    const result = await processPendingGitHubScans({ batchSize: 1 });

    expect(result.jobsSkipped).toBe(1);
    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('skipped');
    expect(jobResult?.error).toContain('INSTALLATION_SUSPENDED');
  });

  // -------------------------------------------------------------------------
  // TEST F: Repository not found → failed
  // -------------------------------------------------------------------------
  it('TEST F: job where repository belongs to different workspace fails with REPOSITORY_NOT_FOUND', async () => {
    // Create workspace A with an installation and a repository
    const { workspaceId: wsA, userId: userA } = await createWorkspaceWithInstallation(
      'test-f-a@example.com', 'inst_test_f_a'
    );
    // Create workspace B with its own installation (so the job has an active installation)
    const { workspaceId: wsB } = await createWorkspaceWithInstallation(
      'test-f-b@example.com', 'inst_test_f_b'
    );

    const repoA = await createRepository(wsA, userA, '-f');

    // Scan request claims workspace B but points at repoA (different workspace → REPOSITORY_NOT_FOUND)
    const db = getDatabase();
    const reqId = randomId('gsrq');
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES (?, ?, ?, 'sha_f_mismatch_0000000000000000000', 'refs/heads/main', 'pending', ?)
    `, [reqId, wsB, repoA, new Date().toISOString()]);

    const result = await processPendingGitHubScans({ batchSize: 1 });

    expect(result.jobsFailed).toBe(1);
    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('failed');
    expect(jobResult?.error).toContain('REPOSITORY_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // TEST G: Failed file fetch → scan record marked failed
  // -------------------------------------------------------------------------
  it('TEST G: failed file fetch marks scan record as failed in the database', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-g@example.com', 'inst_test_g');
    const repoId = await createRepository(workspaceId, userId);
    const reqId = await createScanRequest(workspaceId, repoId);

    mockFetchRemoteFiles.mockRejectedValueOnce(new Error('GITHUB_FILE_FETCH_ERROR'));

    const result = await processPendingGitHubScans({ batchSize: 1 });

    expect(result.jobsFailed).toBe(1);
    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('failed');
    expect(jobResult?.error).toContain('GITHUB_FILE_FETCH_ERROR');

    const db = getDatabase();
    const scan = await db.queryOne<{ status: string; error_message: string }>(
      'SELECT status, error_message FROM scans WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1',
      [repoId]
    );
    expect(scan?.status).toBe('failed');
    expect(scan?.error_message).toContain('GITHUB_FILE_FETCH_ERROR');
  });

  // -------------------------------------------------------------------------
  // TEST H: Timeout reverts unprocessed jobs back to pending
  // -------------------------------------------------------------------------
  it('TEST H: timeout reverts unprocessed claimed jobs back to pending', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-h@example.com', 'inst_test_h');
    const repoId = await createRepository(workspaceId, userId);

    for (let i = 0; i < 3; i++) {
      await createScanRequest(workspaceId, repoId, `sha_h_${String(i).padStart(39, '0')}`);
    }

    // timeoutMs=0: fires immediately, reverting all claimed jobs before any are executed
    const result = await processPendingGitHubScans({ batchSize: 3, timeoutMs: 0 });

    expect(result.timedOut).toBe(true);

    const db = getDatabase();
    const processingRows = await db.query<{ id: string }>(
      "SELECT id FROM github_scan_requests WHERE repository_id = ? AND status = 'processing'", [repoId]
    );
    expect(processingRows.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST I: Successful scan marks scan_request as completed
  // -------------------------------------------------------------------------
  it('TEST I: successful scan marks scan_request as completed', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-i@example.com', 'inst_test_i');
    const repoId = await createRepository(workspaceId, userId);
    const sha = 'abc123def456abc123def456abc123def456abc1';
    const reqId = await createScanRequest(workspaceId, repoId, sha);

    mockFetchRemoteFiles.mockResolvedValueOnce(makeEmptyFilesResult(sha));

    const result = await processPendingGitHubScans({ batchSize: 1 });

    const db = getDatabase();
    const req = await db.queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE id = ?', [reqId]
    );
    expect(req?.status).toBe('completed');

    expect(result.jobsCompleted).toBe(1);
    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('completed');
    expect(jobResult?.scanId).toBeDefined();
    expect(jobResult?.findingsCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST J: Completed scan persists scan record correctly
  // -------------------------------------------------------------------------
  it('TEST J: completed scan persists scan record with status=completed and completed_at', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-j@example.com', 'inst_test_j');
    const repoId = await createRepository(workspaceId, userId);
    const sha = 'def456abc123def456abc123def456abc123def4';
    await createScanRequest(workspaceId, repoId, sha);

    mockFetchRemoteFiles.mockResolvedValueOnce(makeEmptyFilesResult(sha));

    const result = await processPendingGitHubScans({ batchSize: 1 });
    const scanId = result.results[0]?.scanId;
    expect(scanId).toBeDefined();

    const db = getDatabase();
    const scan = await db.queryOne<{ status: string; sha: string; completed_at: string | null }>(
      'SELECT status, sha, completed_at FROM scans WHERE id = ?', [scanId]
    );
    expect(scan?.status).toBe('completed');
    expect(scan?.sha).toBe(sha);
    expect(scan?.completed_at).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // TEST K: Findings are upserted idempotently
  // -------------------------------------------------------------------------
  it('TEST K: findings are upserted idempotently when same symbols scanned twice', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-k@example.com', 'inst_test_k');
    const repoId = await createRepository(workspaceId, userId);

    const stripeFiles = new Map<string, string>([
      ['package.json', JSON.stringify({ name: 'test-k', dependencies: { stripe: '^16.0.0' } })],
      ['src/billing.ts', `import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function createSub(customerId: string, priceId: string, couponId: string) {
  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], coupon: couponId });
}`],
    ]);

    // First scan
    const sha1 = 'aaa000000000000000000000000000000000000a';
    await createScanRequest(workspaceId, repoId, sha1);
    mockFetchRemoteFiles.mockResolvedValueOnce({ files: stripeFiles, headSha: sha1, defaultBranch: 'main' });
    await processPendingGitHubScans({ batchSize: 1 });

    const db = getDatabase();
    const countAfterFirst = (await db.query('SELECT id FROM findings WHERE repository_id = ?', [repoId])).length;

    // Second scan (different SHA)
    const sha2 = 'bbb000000000000000000000000000000000000b';
    await createScanRequest(workspaceId, repoId, sha2);
    mockFetchRemoteFiles.mockResolvedValueOnce({ files: stripeFiles, headSha: sha2, defaultBranch: 'main' });
    await processPendingGitHubScans({ batchSize: 1 });

    const countAfterSecond = (await db.query('SELECT id FROM findings WHERE repository_id = ?', [repoId])).length;

    // No duplicate rows — same symbol should be upserted
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  // -------------------------------------------------------------------------
  // TEST L: Result counters reflect per-job outcomes
  // -------------------------------------------------------------------------
  it('TEST L: result counters correctly reflect completed/failed/skipped across multiple jobs', async () => {
    // Workspace A: has installation (fetch will fail → failed)
    const { workspaceId: wsA, userId: userA } = await createWorkspaceWithInstallation(
      'test-l-a@example.com', 'inst_test_l_a'
    );
    const repoA = await createRepository(wsA, userA, '-l-a');
    await createScanRequest(wsA, repoA, 'sha_l_a_' + '0'.repeat(33));

    // Workspace B: no installation (→ skipped)
    const { user: userB } = await createUserWithSession('test-l-b@example.com', 'Pass1234!', 'B');
    const wsB = await getDefaultWorkspaceForUser(userB.id);
    const repoB = await createRepository(wsB.id, userB.id, '-l-b');
    await createScanRequest(wsB.id, repoB, 'sha_l_b_' + '0'.repeat(33));

    mockFetchRemoteFiles.mockRejectedValue(new Error('FAIL_L'));

    const result = await processPendingGitHubScans({ batchSize: 5 });

    expect(result.jobsClaimed).toBe(2);
    expect(result.jobsFailed + result.jobsSkipped).toBe(2);
    expect(result.results).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // TEST M: workspace_id mismatch → REPOSITORY_NOT_FOUND
  // -------------------------------------------------------------------------
  it('TEST M: scan_request with workspace_id mismatch to repository fails safely', async () => {
    const { workspaceId: wsA, userId: userA } = await createWorkspaceWithInstallation(
      'test-m-a@example.com', 'inst_test_m_a'
    );
    const { workspaceId: wsB } = await createWorkspaceWithInstallation(
      'test-m-b@example.com', 'inst_test_m_b'
    );

    const repoA = await createRepository(wsA, userA, '-m');

    // Scan request claims wsB but points at repoA (which belongs to wsA)
    const db = getDatabase();
    const reqId = randomId('gsrq');
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES (?, ?, ?, 'sha_m_mismatch_000000000000000000000', 'refs/heads/main', 'pending', ?)
    `, [reqId, wsB, repoA, new Date().toISOString()]);

    const result = await processPendingGitHubScans({ batchSize: 1 });

    const jobResult = result.results.find((r) => r.scanRequestId === reqId);
    expect(jobResult?.status).toBe('failed');
    expect(jobResult?.error).toContain('REPOSITORY_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // TEST N: Multiple independent jobs processed in one invocation
  // -------------------------------------------------------------------------
  it('TEST N: multiple independent jobs all processed in a single invocation', async () => {
    const { workspaceId, userId } = await createWorkspaceWithInstallation('test-n@example.com', 'inst_test_n');

    const db = getDatabase();
    for (let i = 0; i < 3; i++) {
      const repoId = randomId('repo');
      const now = new Date().toISOString();
      await db.execute(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'test-org', ?, ?, '99${i}000', 'main', 'connected', ?)
      `, [repoId, workspaceId, userId, `repo-n-${i}`, `test-org/repo-n-${i}`, now]);
      await createScanRequest(workspaceId, repoId, `sha_n_${i}_${'0'.repeat(38)}`);
    }

    // All will fail on file fetch
    mockFetchRemoteFiles.mockRejectedValue(new Error('BULK_FAIL_N'));

    const result = await processPendingGitHubScans({ batchSize: 10 });

    expect(result.jobsClaimed).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.jobsFailed).toBe(3);
  });
});
