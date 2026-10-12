import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserAsync } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { enqueueRepositoryScan } from '../apps/web/src/lib/server/scan-request-service.js';
import { recordWorkspaceUsage } from '../apps/web/src/lib/server/billing/service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-manual-scan-queue.db');
const SHA = '0123456789abcdef0123456789abcdef01234567';

async function createRepository() {
  const user = await createUserAsync(`manual-scan-${Date.now()}@apiproof.test`, 'Pass1234!#$', 'Manual Scan User');
  const workspace = await getDefaultWorkspaceForUser(user.id);
  const repositoryId = `repo_manual_${Date.now()}`;
  await getDatabase().execute(`
    INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
    VALUES (?, ?, ?, 'example', 'fixture', 'example/fixture', '12345', 'main', 'connected', ?)
  `, [repositoryId, workspace.id, user.id, new Date().toISOString()]);
  return { repositoryId, workspaceId: workspace.id };
}

describe('manual scan queue integration', () => {
  beforeEach(() => {
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
  });

  it('enqueues one logical repository+SHA scan under concurrent requests', async () => {
    const repository = await createRepository();
    const input = { ...repository, commitSha: SHA, ref: 'refs/heads/main' };
    const results = await Promise.all([
      enqueueRepositoryScan(input),
      enqueueRepositoryScan(input),
    ]);

    for (const result of results) {
      if (result.created) {
        await recordWorkspaceUsage(repository.workspaceId, 'scans', `${result.repositoryId}:${result.commitSha}`);
      }
    }

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.every((result) => result.requestId === results[0]!.requestId)).toBe(true);
    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?',
      [repository.repositoryId, SHA],
    )).toMatchObject({ count: 1 });
    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM scans WHERE repository_id = ? AND sha = ?',
      [repository.repositoryId, SHA],
    )).toMatchObject({ count: 1 });
    expect(await getDatabase().queryOne<{ count: number }>(
      "SELECT count FROM workspace_usage WHERE workspace_id = ? AND metric = 'scans'",
      [repository.workspaceId],
    )).toMatchObject({ count: 1 });
  });

  it('requeues a completed legacy scan when Productization is enabled', async () => {
    const repository = await createRepository();
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at, raw_result)
      VALUES ('scn_legacy_manual', ?, ?, 'completed', 'multi-provider', ?, ?, ?)
    `, [repository.repositoryId, SHA, now, now, JSON.stringify({ schemaVersion: 'legacy' })]);
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES ('req_legacy_manual', ?, ?, ?, 'refs/heads/main', 'completed', ?)
    `, [repository.workspaceId, repository.repositoryId, SHA, now]);

    const result = await enqueueRepositoryScan({ ...repository, commitSha: SHA, ref: 'refs/heads/main' });
    expect(result.state).toBe('queued');
    expect(result.created).toBe(false);
    expect(await db.queryOne<{ status: string }>('SELECT status FROM github_scan_requests WHERE id = ?', ['req_legacy_manual']))
      .toMatchObject({ status: 'pending' });
  });

  it('reuses completed Productization work without creating another scan row', async () => {
    const repository = await createRepository();
    const now = new Date().toISOString();
    await getDatabase().execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at, raw_result)
      VALUES ('scn_productized_manual', ?, ?, 'completed', 'multi-provider', ?, ?, ?)
    `, [repository.repositoryId, SHA, now, now, JSON.stringify({ schemaVersion: 2, compatibilityResults: [], proofs: [] })]);

    const result = await enqueueRepositoryScan({ ...repository, commitSha: SHA, ref: 'refs/heads/main' });
    expect(result.state).toBe('completed');
    expect(result.created).toBe(false);
    expect(result.scanId).toBe('scn_productized_manual');
  });
});
