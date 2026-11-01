import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { PROVIDER_CHANGE_SOURCES, refreshProviderChangelog } from '../apps/web/src/lib/server/provider-change-monitor.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-source-rescan-fallback.db');

const resolvePublicHost = async () => [{ address: '93.184.216.34' }];

describe('provider source change repository fallback rescans', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    fs.rmSync(TEST_DB_PATH, { force: true });
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(TEST_DB_PATH, { force: true });
  });

  it('queues a repository-level source-change rescan when no approved dynamic rule exists', async () => {
    const { user } = await createUserWithSession('static-source-change@example.com', 'Pass1234!', 'Static Source Change');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const repositoryId = 'static-source-change-repository';
    const now = new Date().toISOString();
    await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', 'static-source-change-repository', 'test-org/static-source-change-repository', '7654400', 'main', 'connected', 'active', ?)`, [repositoryId, workspace.id, user.id, now]);
    const scanId = 'static-source-change-baseline-scan';
    await getDatabase().execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repositoryId, 'b'.repeat(40), now, now]);
    await getDatabase().execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, ?, ?)`, [repositoryId, workspace.id, scanId, now, now, now]);

    let body = '<html>stripe baseline</html>';
    const fetchImpl = async (): Promise<Response> => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    await refreshProviderChangelog('stripe', options);
    body = '<html>stripe breaking update</html>';
    const changed = await refreshProviderChangelog('stripe', options);

    expect(changed.rescansQueued).toBeUndefined();
    expect(changed.repositoryRescansQueued).toBe(1);
    expect(await getDatabase().queryOne<{ reason: string; status: string }>(
      'SELECT reason, status FROM repository_rescan_jobs WHERE repository_id = ?',
      [repositoryId],
    )).toEqual({ reason: 'provider_source_changed', status: 'pending' });
  });

  it('queues a bounded repository rescan for an update from every monitored provider', async () => {
    const { user } = await createUserWithSession('all-provider-source-change@example.com', 'Pass1234!', 'All Provider Source Change');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const now = new Date('2027-01-01T00:00:00.000Z').toISOString();
    const sources = PROVIDER_CHANGE_SOURCES;

    for (const [index, source] of sources.entries()) {
      const repositoryId = `all-provider-source-change-${index}`;
      const scanId = `all-provider-source-scan-${index}`;
      await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES (?, ?, ?, 'test-org', ?, ?, ?, 'main', 'connected', 'active', ?)`, [repositoryId, workspace.id, user.id, repositoryId, `test-org/${repositoryId}`, `${7655000 + index}`, now]);
      await getDatabase().execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [scanId, repositoryId, 'b'.repeat(40), now, now]);
      await getDatabase().execute(`INSERT INTO repository_provider_usage (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [repositoryId, workspace.id, source.providerId, scanId, now, now, now]);
    }

    const bodies = new Map(sources.map((source) => [source.sourceUrl, `<html>${source.providerId} baseline</html>`]));
    const fetchImpl = async (input: Parameters<typeof fetch>[0]): Promise<Response> => new Response(bodies.get(input.toString()) ?? '<html>unknown</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    const options = { fetchImpl, resolveHost: resolvePublicHost };
    for (const source of sources) await refreshProviderChangelog(source.providerId, { ...options, now: () => new Date('2027-01-01T00:00:00.000Z') });
    for (const source of sources) {
      bodies.set(source.sourceUrl, `<html>${source.providerId} API update</html>`);
      const changed = await refreshProviderChangelog(source.providerId, { ...options, now: () => new Date('2027-01-01T07:00:00.000Z') });
      expect(changed.status, source.providerId).toBe('changed');
      expect(changed.repositoryRescansQueued, source.providerId).toBe(1);
    }

    expect(await getDatabase().queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM repository_rescan_jobs WHERE reason = 'provider_source_changed'`)).toEqual({ count: 19 });
  });
});
