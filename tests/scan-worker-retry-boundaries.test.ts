import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { markScanWorkerJobFailed } from '../apps/web/src/lib/server/scan-worker-state.js';

const TEST_DB_PATH = path.resolve('.tmp/test-sec13-retry-boundaries.db');
const ENVIRONMENT_KEYS = ['NODE_ENV', 'APIPROOF_DB_PATH', 'APIPROOF_SKIP_DEFAULT_SEED'] as const;
let originalEnvironment: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string>>;

async function insertProcessingJob(id: string, attemptCount: number): Promise<void> {
  const db = getDatabase();
  const now = '2026-11-09T00:00:00.000Z';
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [`workspace-${id}`, 'Retry Test Workspace', `retry-${id}`, now, now],
  );
  await db.execute(
    `INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`repository-${id}`, `workspace-${id}`, 'test-org', `repo-${id}`, `test-org/repo-${id}`, `github-${id}`, 'main', now],
  );
  await db.execute(
    `INSERT INTO github_scan_requests
      (id, workspace_id, repository_id, commit_sha, ref, status, attempt_count, created_at)
     VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`,
    [id, `workspace-${id}`, `repository-${id}`, `sha-${id}`, 'main', attemptCount, now],
  );
}

describe('SEC-13 scan-worker retry boundaries', () => {
  beforeEach(() => {
    originalEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const key of ENVIRONMENT_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns a retryable GitHub outage to pending before the attempt limit', async () => {
    await insertProcessingJob('retryable', 1);
    await markScanWorkerJobFailed(getDatabase(), {
      id: 'retryable', repository_id: 'repository-retryable', commit_sha: 'sha-retryable', attempt_count: 1,
    }, 'GITHUB_UNAVAILABLE', 'temporary provider outage');

    await expect(getDatabase().queryOne<{ status: string; last_error_category: string }>(
      'SELECT status, last_error_category FROM github_scan_requests WHERE id = ?', ['retryable'],
    )).resolves.toEqual({ status: 'pending', last_error_category: 'GITHUB_UNAVAILABLE' });
  });

  it('makes the third retryable attempt terminal', async () => {
    await insertProcessingJob('third-attempt', 3);
    await markScanWorkerJobFailed(getDatabase(), {
      id: 'third-attempt', repository_id: 'repository-third-attempt', commit_sha: 'sha-third-attempt', attempt_count: 3,
    }, 'GITHUB_NETWORK', 'network unavailable');

    await expect(getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE id = ?', ['third-attempt'],
    )).resolves.toEqual({ status: 'failed' });
  });

  it('does not retry non-retryable failures even on the first attempt', async () => {
    await insertProcessingJob('permanent', 1);
    await markScanWorkerJobFailed(getDatabase(), {
      id: 'permanent', repository_id: 'repository-permanent', commit_sha: 'sha-permanent', attempt_count: 1,
    }, 'INVALID_SOURCE', 'source is not supported');

    await expect(getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM github_scan_requests WHERE id = ?', ['permanent'],
    )).resolves.toEqual({ status: 'failed' });
  });

  it('bounds persisted failure messages and removes control characters', async () => {
    await insertProcessingJob('sanitized', 1);
    await markScanWorkerJobFailed(getDatabase(), {
      id: 'sanitized', repository_id: 'repository-sanitized', commit_sha: 'sha-sanitized', attempt_count: 1,
    }, 'GITHUB_RATE_LIMIT', `first line\nsecond line\t${'x'.repeat(600)}`);

    const row = await getDatabase().queryOne<{ last_error_message: string }>(
      'SELECT last_error_message FROM github_scan_requests WHERE id = ?', ['sanitized'],
    );
    expect(row?.last_error_message).toHaveLength(500);
    expect(row?.last_error_message).not.toMatch(/[\r\n\t]/);
  });
});
