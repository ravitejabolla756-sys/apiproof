import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { GET as providerChangelogGet, POST as providerChangelogPost } from '../apps/web/src/app/api/internal/provider-changelog/route.js';
import { GET as scheduledRescanGet } from '../apps/web/src/app/api/internal/scheduled-rescan/route.js';
import { GET as providerIntelligenceStatusGet } from '../apps/web/src/app/api/internal/provider-intelligence/status/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-intelligence-cron-routes.db');
const CRON_SECRET = 'provider-intelligence-cron-fixture';

describe('provider intelligence cron route contracts', () => {
  const originalDbPath = process.env.APIPROOF_DB_PATH;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalFeatureFlag = process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.CRON_SECRET = CRON_SECRET;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (originalDbPath === undefined) delete process.env.APIPROOF_DB_PATH;
    else process.env.APIPROOF_DB_PATH = originalDbPath;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalFeatureFlag === undefined) delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
    else process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = originalFeatureFlag;
  });

  it('rejects changelog refreshes without the exact cron secret', async () => {
    const response = await providerChangelogGet(new NextRequest('http://localhost/api/internal/provider-changelog'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('rejects an unknown provider before attempting a source fetch', async () => {
    const response = await providerChangelogPost(new NextRequest('http://localhost/api/internal/provider-changelog', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ providerId: 'not-on-the-approved-source-catalog' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'UNKNOWN_PROVIDER_SOURCE' });
  });

  it('runs the nightly rescan contract with an empty queue', async () => {
    const response = await scheduledRescanGet(new Request('http://localhost/api/internal/scheduled-rescan', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      scheduled: 0,
      processed: {
        jobsClaimed: 0,
        jobsQueued: 0,
        jobsFailed: 0,
      },
    });
  });

  it('exposes protected rollout, source, and queue readiness without source contents', async () => {
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    const response = await providerIntelligenceStatusGet(new NextRequest('http://localhost/api/internal/provider-intelligence/status', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as {
      ok: boolean;
      configuration: { readyForLiveBeta: boolean; liveGithubWriteEnabled: boolean };
      runtime: { productizationV1Enabled: boolean; providerRegistryDigest: string };
      sources: Array<{ providerId: string; status: string; parserStatus: string }>;
      queues: { approvedCandidates: number; reviewCandidates: number; pendingRescans: number; pendingProviderRescans: number; pendingRepositoryRescans: number; pendingScanRequests: number };
    };
    expect(body.ok).toBe(true);
    expect(body.configuration).toMatchObject({ readyForLiveBeta: false, liveGithubWriteEnabled: false });
    expect(body.runtime.productizationV1Enabled).toBe(true);
    expect(body.runtime.providerRegistryDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(body.sources).toHaveLength(19);
    expect(body.sources.every((source) => source.status === 'never-run' && source.parserStatus === 'not-run')).toBe(true);
    expect(body.queues).toMatchObject({ approvedCandidates: 0, reviewCandidates: 0, pendingRescans: 0, pendingProviderRescans: 0, pendingRepositoryRescans: 0, pendingScanRequests: 0 });
    expect(JSON.stringify(body)).not.toContain('source body');
  });

  it('reports repository-level fallback rescans in the protected queue status', async () => {
    const { user } = await createUserWithSession('status-fallback@example.com', 'Pass1234!', 'Status Fallback');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES ('status-fallback-repository', ?, ?, 'test-org', 'status-fallback', 'test-org/status-fallback', '7654332', 'main', 'connected', 'active', ?)`, [workspace.id, user.id, now]);
    await getDatabase().execute(`INSERT INTO repository_rescan_jobs (id, workspace_id, repository_id, reason, created_at, updated_at) VALUES ('status-fallback-job', ?, 'status-fallback-repository', 'provider_source_changed', ?, ?)`, [workspace.id, now, now]);

    const response = await providerIntelligenceStatusGet(new NextRequest('http://localhost/api/internal/provider-intelligence/status', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }));
    const body = await response.json() as { queues: { pendingRescans: number; pendingProviderRescans: number; pendingRepositoryRescans: number } };

    expect(response.status).toBe(200);
    expect(body.queues).toMatchObject({ pendingRescans: 1, pendingProviderRescans: 0, pendingRepositoryRescans: 1 });
  });

  it('keeps the repository scheduler scoped to the safe orchestration routes', () => {
    const workflow = fs.readFileSync(path.resolve('.github/workflows/my-owl-scheduler.yml'), 'utf8');
    expect(workflow).toContain("cron: '0 */6 * * *'");
    expect(workflow).toContain("cron: '0 2 * * *'");
    expect(workflow).toContain('group: my-owl-scheduler');
    expect(workflow).toContain('timeout-minutes: 10');
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toContain('/api/internal/provider-changelog');
    expect(workflow).toContain('/api/internal/scheduled-rescan');
    expect(workflow).not.toContain('/api/internal/scan-worker');
  });
});
