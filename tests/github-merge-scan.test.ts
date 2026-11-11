import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { enqueueMergedPullRequestScan } from '../apps/web/src/lib/server/github-merge-scan.js';

const DB_PATH = path.resolve(`.tmp/github-merge-scan-${process.pid}.db`);

describe('PR-07 merged commit enqueue boundary', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_LOCAL_SEED_PASSWORD = 'pr07-local-only';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  async function fixture() {
    const { user } = await createUserWithSession(`pr07-${process.pid}@example.test`, 'Pass1234!', 'PR-07 User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    const now = new Date().toISOString();
    const key = crypto.randomBytes(6).toString('hex');
    const repositoryId = `repo_${key}`;
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, 'pr07-org', ?, ?, ?, 'main', 'connected', 'connected', 'active', ?)
    `, [repositoryId, workspace.id, user.id, `repo-${key}`, `pr07-org/repo-${key}`, `gh-${key}`, now]);
    return { db, workspaceId: workspace.id, repositoryId, now };
  }

  it('creates one durable queue request and pending scan for a merged SHA', async () => {
    const local = await fixture();
    const sha = 'a'.repeat(40);
    const first = await enqueueMergedPullRequestScan(local.db, {
      deliveryId: 'delivery-pr07-a', repositoryId: local.repositoryId, workspaceId: local.workspaceId,
      defaultBranch: 'main', commitSha: sha, now: local.now,
    });
    const second = await enqueueMergedPullRequestScan(local.db, {
      deliveryId: 'delivery-pr07-b', repositoryId: local.repositoryId, workspaceId: local.workspaceId,
      defaultBranch: 'main', commitSha: sha, now: local.now,
    });
    expect(second).toBe(first);
    expect(await local.db.query('SELECT id FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?', [local.repositoryId, sha])).toHaveLength(1);
    expect(await local.db.query('SELECT id FROM scans WHERE repository_id = ? AND sha = ? AND triggered_by = ?', [local.repositoryId, sha, 'pull_request_merge'])).toHaveLength(1);
  });

  it('requeues a failed request and failed scan without creating a duplicate', async () => {
    const local = await fixture();
    const sha = 'b'.repeat(40);
    const id = await enqueueMergedPullRequestScan(local.db, {
      deliveryId: 'delivery-pr07-c', repositoryId: local.repositoryId, workspaceId: local.workspaceId,
      defaultBranch: 'main', commitSha: sha, now: local.now,
    });
    await local.db.execute("UPDATE github_scan_requests SET status = 'failed', last_error_category = 'SCAN_EXECUTION_FAILED' WHERE id = ?", [id]);
    await local.db.execute("UPDATE scans SET status = 'failed' WHERE repository_id = ? AND sha = ?", [local.repositoryId, sha]);
    expect(await enqueueMergedPullRequestScan(local.db, {
      deliveryId: 'delivery-pr07-d', repositoryId: local.repositoryId, workspaceId: local.workspaceId,
      defaultBranch: 'main', commitSha: sha, now: new Date().toISOString(),
    })).toBe(id);
    expect(await local.db.query('SELECT id FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?', [local.repositoryId, sha])).toHaveLength(1);
    expect(await local.db.queryOne<{ status: string; triggered_by: string }>('SELECT status, triggered_by FROM scans WHERE repository_id = ? AND sha = ?', [local.repositoryId, sha])).toEqual({ status: 'pending', triggered_by: 'pull_request_merge' });
  });
});
