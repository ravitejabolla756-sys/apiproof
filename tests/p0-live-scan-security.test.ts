import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { processGitHubWebhook } from '../apps/web/src/lib/server/github-webhooks.js';
import { processPendingGitHubScans } from '../apps/web/src/lib/server/scan-worker.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { POST as workerPostHandler } from '../apps/web/src/app/api/internal/scan-worker/route.js';
import {
  assertLiveScanEnabled,
} from '../apps/web/src/lib/server/live-scan-authorization.js';

const TEST_DB_PATH = path.resolve('.tmp/test-p0-live-scan-security.db');

describe('P0 live scan security boundary', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ['APIPROOF_ENABLE_LIVE_GITHUB', 'APIPROOF_DB_PATH', 'CRON_SECRET']) {
      originalEnv[key] = process.env[key];
    }
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'true';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('enables live scanning without a global founder identity', () => {
    expect(() => assertLiveScanEnabled()).not.toThrow();
  });

  it('blocks direct scan service calls before repository access for users without repository access', async () => {
    await expect(runRepositoryScan('repo_not_authorized', 'usr_other'))
      .rejects.toThrow('Repository not found or access denied.');
  });

  it('queues push scans for connected repositories in every workspace', async () => {
    const { user: founder } = await createUserWithSession('founder-security@test.com', 'Pass1234!', 'Founder');
    const founderWorkspace = await getDefaultWorkspaceForUser(founder.id);
    const { user: other } = await createUserWithSession('other-security@test.com', 'Pass1234!', 'Other');
    const otherWorkspace = await getDefaultWorkspaceForUser(other.id);
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_founder_security', ?, '160401452', 'ravitejabolla756-sys', 'User', 'active', ?, ?),
             ('gi_other_security', ?, '160401453', 'other-account', 'User', 'active', ?, ?)
    `, [founderWorkspace.id, now, now, otherWorkspace.id, now, now]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at)
      VALUES ('repo_founder_security', ?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', 'active', ?),
             ('repo_other_security', ?, ?, 'other-account', 'other-repo', 'other-account/other-repo', '1363070569', 'main', 'connected', 'active', ?)
    `, [founderWorkspace.id, founder.id, now, otherWorkspace.id, other.id, now]);

    const founderResult = await processGitHubWebhook({
      event: 'push',
      deliveryId: 'delivery_founder_security',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'a'.repeat(40), repository: { id: 1363070568 } }),
    });
    const otherResult = await processGitHubWebhook({
      event: 'push',
      deliveryId: 'delivery_other_security',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'b'.repeat(40), repository: { id: 1363070569 } }),
    });

    expect(founderResult.handled).toBe(true);
    expect(otherResult.handled).toBe(true);
    expect((await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM github_scan_requests WHERE repository_id = ?', ['repo_founder_security']))?.count).toBe(1);
    expect((await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM github_scan_requests WHERE repository_id = ?', ['repo_other_security']))?.count).toBe(1);
  });

  it('processes pending jobs across workspaces and still supports exact repository scope', async () => {
    const { user: founder } = await createUserWithSession('founder-worker-security@test.com', 'Pass1234!', 'Founder');
    const founderWorkspace = await getDefaultWorkspaceForUser(founder.id);
    const { user: other } = await createUserWithSession('other-worker-security@test.com', 'Pass1234!', 'Other');
    const otherWorkspace = await getDefaultWorkspaceForUser(other.id);
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_founder_worker_security', ?, '160401454', 'founder-account', 'User', 'suspended', ?, ?),
             ('gi_other_worker_security', ?, '160401455', 'other-account', 'User', 'suspended', ?, ?)
    `, [founderWorkspace.id, now, now, otherWorkspace.id, now, now]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at)
      VALUES ('repo_founder_worker_security', ?, ?, 'founder-account', 'founder-repo', 'founder-account/founder-repo', '1363070570', 'main', 'connected', 'active', ?),
             ('repo_other_worker_security', ?, ?, 'other-account', 'other-repo', 'other-account/other-repo', '1363070571', 'main', 'connected', 'active', ?)
    `, [founderWorkspace.id, founder.id, now, otherWorkspace.id, other.id, now]);
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES ('req_founder_worker_security', ?, 'repo_founder_worker_security', ?, 'refs/heads/main', 'pending', ?),
             ('req_other_worker_security', ?, 'repo_other_worker_security', ?, 'refs/heads/main', 'pending', ?)
    `, [founderWorkspace.id, 'c'.repeat(40), now, otherWorkspace.id, 'd'.repeat(40), now]);

    const result = await processPendingGitHubScans({ batchSize: 10 });
    expect(result.jobsClaimed).toBe(2);
    expect((await db.queryOne<{ status: string }>('SELECT status FROM github_scan_requests WHERE id = ?', ['req_other_worker_security']))?.status).toBe('failed');
    expect((await db.queryOne<{ status: string }>('SELECT status FROM github_scan_requests WHERE id = ?', ['req_founder_worker_security']))?.status).toBe('failed');
  });

  it('allows the protected worker route to drain a bounded batch across workspaces', async () => {
    process.env.CRON_SECRET = 'local-cron-secret';

    const response = await workerPostHandler(new NextRequest('http://localhost/api/internal/scan-worker', {
      method: 'POST',
      headers: {
        authorization: 'Bearer local-cron-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ batchSize: 1, metricsOnly: true }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
    });
  });
});
