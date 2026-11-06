import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { recordFindingCreated, transitionFinding } from '../apps/web/src/lib/server/finding-lifecycle.js';
import { classifyMergedFinding, recordFindingResolutionVerification } from '../apps/web/src/lib/server/finding-resolution-verification.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-finding-lifecycle-${process.pid}.db`);

describe('finding lifecycle state machine', () => {
  let userId = '';
  let workspaceId = '';
  let repositoryId = '';
  let findingId = '';
  let scanId = '';

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
    const account = await createUserWithSession(`finding-${process.pid}@example.test`, 'OriginalPassword123!', 'Finding Owner');
    userId = account.user.id;
    workspaceId = (await getDatabase().queryOne<{ id: string }>('SELECT id FROM workspaces WHERE name = ?', ["Finding Owner's Workspace"]))!.id;
    repositoryId = `repo_lifecycle_${Date.now()}`;
    findingId = `fnd_lifecycle_${Date.now()}`;
    scanId = `scan_lifecycle_${Date.now()}`;
    await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)`, [repositoryId, workspaceId, userId, 'owner', 'repo', `owner/repo-${repositoryId}`, `gh-${repositoryId}`, 'main', new Date().toISOString()]);
    await getDatabase().execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'fixture', ?, ?)`, [scanId, repositoryId, 'a'.repeat(40), new Date().toISOString(), new Date().toISOString()]);
    await getDatabase().execute(`INSERT INTO findings (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`, [findingId, scanId, repositoryId, 'usage-1', 'change-1', 'fixture', 'Fixture finding', 'Fixture description', 'high', 0.9, 'src/app.ts', 4, 'call', 'reason', '[]', '{}', new Date().toISOString()]);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records idempotent transitions and rejects invalid edges', async () => {
    const db = getDatabase();
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'acknowledged', reason: 'operator_reviewed', idempotencyKey: 'finding-event-1', actorUserId: userId })).resolves.toMatchObject({ changed: true, state: 'acknowledged' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'acknowledged', reason: 'operator_reviewed', idempotencyKey: 'finding-event-1', actorUserId: userId })).resolves.toMatchObject({ changed: false, state: 'acknowledged' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'verified_resolved', reason: 'missing evidence', idempotencyKey: 'finding-event-2' })).rejects.toThrow('FINDING_RESOLUTION_EVIDENCE_REQUIRED');
    expect(await db.query('SELECT id FROM finding_lifecycle_events WHERE finding_id = ?', [findingId])).toHaveLength(1);
  });

  it('requires a completed scan for verified resolution and supports regression reopen', async () => {
    const db = getDatabase();
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'verified_resolved', reason: 'scan evidence', idempotencyKey: 'finding-event-resolve', evidence: { scanId } })).resolves.toMatchObject({ changed: true, state: 'verified_resolved' });
    expect(await db.queryOne<{ status: string; lifecycle_state: string }>('SELECT status, lifecycle_state FROM findings WHERE id = ?', [findingId])).toEqual({ status: 'resolved', lifecycle_state: 'verified_resolved' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'reopened', reason: 'finding reappeared', idempotencyKey: 'finding-event-reopen', evidence: { scanId } })).resolves.toMatchObject({ changed: true, state: 'reopened' });
    expect(await db.queryOne<{ status: string; lifecycle_state: string }>('SELECT status, lifecycle_state FROM findings WHERE id = ?', [findingId])).toEqual({ status: 'open', lifecycle_state: 'reopened' });
  });

  it('enforces tenant ownership and conditional concurrency semantics', async () => {
    const db = getDatabase();
    await expect(transitionFinding(db, { findingId, workspaceId: 'workspace-attacker', toState: 'acknowledged', reason: 'attack', idempotencyKey: 'finding-event-attack' })).rejects.toThrow('FINDING_WORKSPACE_MISMATCH');
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'remediating', reason: 'plan created', idempotencyKey: 'finding-event-remediate' })).resolves.toMatchObject({ changed: true, state: 'remediating' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'fixed_pending_verification', reason: 'missing pull request evidence', idempotencyKey: 'finding-event-invalid' })).resolves.toMatchObject({ changed: true, state: 'fixed_pending_verification' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'reopened', reason: 'finding reappeared', idempotencyKey: 'finding-event-reopen-after-plan' })).resolves.toMatchObject({ changed: true, state: 'reopened' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'fixed_pending_verification', reason: 'invalid edge', idempotencyKey: 'finding-event-invalid-edge' })).rejects.toThrow('FINDING_LIFECYCLE_TRANSITION_REJECTED');
  });

  it('does not duplicate detection audit events on repeated scan persistence', async () => {
    const db = getDatabase();
    await recordFindingCreated(db, { findingId, repositoryId, workspaceId, actorUserId: userId, scanId });
    await recordFindingCreated(db, { findingId, repositoryId, workspaceId, actorUserId: userId, scanId });
    expect(await db.query('SELECT id FROM finding_lifecycle_events WHERE finding_id = ?', [findingId])).toHaveLength(1);
  });

  it('rejects idempotency-key reuse for a conflicting transition and converges concurrent retries', async () => {
    const db = getDatabase();
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'acknowledged', reason: 'operator_reviewed', idempotencyKey: 'finding-event-conflict' })).resolves.toMatchObject({ changed: true, state: 'acknowledged' });
    await expect(transitionFinding(db, { findingId, workspaceId, toState: 'remediating', reason: 'different meaning', idempotencyKey: 'finding-event-conflict' })).rejects.toThrow('FINDING_LIFECYCLE_IDEMPOTENCY_CONFLICT');

    const results = await Promise.all([
      transitionFinding(db, { findingId, workspaceId, toState: 'remediating', reason: 'plan created', idempotencyKey: 'finding-event-concurrent' }),
      transitionFinding(db, { findingId, workspaceId, toState: 'remediating', reason: 'plan created', idempotencyKey: 'finding-event-concurrent' }),
    ]);
    expect(results.filter((result) => result.changed)).toHaveLength(1);
    expect(results.every((result) => result.state === 'remediating')).toBe(true);
    expect(await db.query('SELECT id FROM finding_lifecycle_events WHERE idempotency_key = ?', ['finding-event-concurrent'])).toHaveLength(1);
  });

  it('classifies merged finding outcomes and persists resolution evidence idempotently', async () => {
    expect(classifyMergedFinding({ scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false })).toBe('resolved');
    expect(classifyMergedFinding({ scanCompleted: true, findingPresent: true, previousState: 'fixed_pending_verification', conflictingActiveChange: false })).toBe('unresolved');
    expect(classifyMergedFinding({ scanCompleted: true, findingPresent: true, previousState: 'verified_resolved', conflictingActiveChange: false })).toBe('regressed');
    expect(classifyMergedFinding({ scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: true })).toBe('ambiguous');
    expect(classifyMergedFinding({ scanCompleted: false, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false })).toBe('inconclusive');

    const db = getDatabase();
    const migrationId = `mig_resolution_${Date.now()}`;
    const pullRequestId = `pr_resolution_${Date.now()}`;
    await db.execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, baseline_sha, created_at) VALUES (?, ?, ?, ?, 'planned', ?, ?, ?)`, [migrationId, findingId, repositoryId, `plan-${migrationId}`, '{}', 'b'.repeat(40), new Date().toISOString()]);
    await db.execute(`INSERT INTO pull_requests (id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, merge_sha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'merged', ?, ?)`, [pullRequestId, migrationId, repositoryId, 42, 'Resolution', 'fix/resolution', 'main', 'https://example.test/pr/42', 'c'.repeat(40), new Date().toISOString()]);
    const evidence = { baselineSha: 'b'.repeat(40), mergeSha: 'c'.repeat(40), scanId };
    await recordFindingResolutionVerification(db, { workspaceId, repositoryId, findingId, migrationId, pullRequestId, mergeSha: 'c'.repeat(40), scanId, classification: 'resolved', evidence });
    await recordFindingResolutionVerification(db, { workspaceId, repositoryId, findingId, migrationId, pullRequestId, mergeSha: 'c'.repeat(40), scanId, classification: 'resolved', evidence });
    expect(await db.query('SELECT id FROM finding_resolution_verifications WHERE migration_id = ?', [migrationId])).toHaveLength(1);
  });
});
