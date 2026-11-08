import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { GET as activityGet } from '../apps/web/src/app/api/activity/route.js';
import { GET as findingsGet } from '../apps/web/src/app/api/findings/route.js';
import { GET as migrationsGet } from '../apps/web/src/app/api/migrations/route.js';
import { GET as pullRequestsGet } from '../apps/web/src/app/api/pull-requests/route.js';
import { GET as findingGet } from '../apps/web/src/app/api/findings/[id]/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-workspace-read-route-role.db');
const ORIGINAL_DB_PATH = process.env.APIPROOF_DB_PATH;
const ORIGINAL_SKIP_SEED = process.env.APIPROOF_SKIP_DEFAULT_SEED;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const REPORT_LEAK_MARKER = 'ghp_verification_output_secret_123456';

function persistedVerificationReport(): string {
  return JSON.stringify({
    schemaVersion: '1.0',
    migrationId: 'role_migration',
    repositoryId: 'role-repo-1',
    failureReasons: [`Verification failed: ${REPORT_LEAK_MARKER}`],
    diagnosticDetails: `unexpected legacy wrapper field ${REPORT_LEAK_MARKER}`,
    report: {
      verificationId: 'verification-role-test', patchId: 'patch-role-test', fixtureId: 'fixture-role-test',
      status: 'VERIFICATION_TEST_FAILED', workspace: `C:\\temp\\${REPORT_LEAK_MARKER}`,
      steps: [{ stage: 'TEST', status: 'FAILED', exitCode: 1, durationMs: 10,
        stdoutDigest: 'a'.repeat(64), stderrDigest: 'b'.repeat(64),
        stdout: REPORT_LEAK_MARKER, stderr: `stderr ${REPORT_LEAK_MARKER}`,
        stdoutTruncated: false, stderrTruncated: false }],
      summary: { buildPassed: false, typecheckPassed: false, testPassed: false, statement: 'Local check failed.' },
      environment: { runtime: 'DockerSandbox', node: 'node:test', lifecycleScriptsEnabled: false, inheritedEnvironment: ['PATH', 'CI', 'NODE_ENV'] },
      networkPolicy: { mode: 'NETWORK_DISABLED', enforced: true },
      resourceLimits: { timeoutMs: 1000, memoryMb: 256, cpu: 'bounded', maxOutputBytes: 1024 },
      artifacts: [], warnings: [REPORT_LEAK_MARKER], requiresHumanReview: true,
    },
  });
}

describe('workspace read route role validation', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ensure isolated database cleanup */ }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (ORIGINAL_DB_PATH === undefined) delete process.env.APIPROOF_DB_PATH;
    else process.env.APIPROOF_DB_PATH = ORIGINAL_DB_PATH;
    if (ORIGINAL_SKIP_SEED === undefined) delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
    else process.env.APIPROOF_SKIP_DEFAULT_SEED = ORIGINAL_SKIP_SEED;
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('serves workspace records to approved roles and denies unknown persisted roles', async () => {
    const { user, session } = await createUserWithSession('read-routes@example.com', 'Pass12345!', 'Read Routes');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    const now = new Date('2026-11-08T00:00:00.000Z').toISOString();

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, created_at)
      VALUES ('role_repo', ?, ?, 'role-owner', 'role-repo', 'role-owner/role-repo', 'role-repo-1', 'main', ?)
    `, [workspace.id, user.id, now]);
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at)
      VALUES ('role_scan', 'role_repo', '0123456789012345678901234567890123456789', 'completed', 'fixture', ?, ?)
    `, [now, now]);
    await db.execute(`
      INSERT INTO findings (
        id, scan_id, repository_id, usage_id, change_id, provider, title, description,
        severity, confidence, file_path, line_number, symbol, status, reason,
        reason_codes, evidence, created_at
      ) VALUES (
        'role_finding', 'role_scan', 'role_repo', 'role_usage', 'role_change', 'fixture',
        'Role fixture finding', 'Synthetic test record', 'low', 0.95, 'src/app.ts', 1,
        'fixture()', 'open', 'test', '[]', '{}', ?
      )
    `, [now]);
    await db.execute(`
      INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, created_at)
      VALUES ('role_migration', 'role_finding', 'role_repo', 'role_plan', 'planned', '{}', ?)
    `, [now]);
    await db.execute(`
      INSERT INTO pull_requests (id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at)
      VALUES ('role_pr', 'role_migration', 'role_repo', 17, 'Role fixture PR', 'codex/fixture', 'main', 'https://example.test/pr/17', 'draft', ?)
    `, [now]);
    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('role_activity', ?, 'role_repo', 'scan_completed', 'Role fixture activity', 'Synthetic test record', ?)
    `, [user.id, now]);
    await db.execute('UPDATE migrations SET verification_report = ? WHERE id = ?', [persistedVerificationReport(), 'role_migration']);

    const routes = [
      { url: 'http://localhost/api/activity', get: activityGet, key: 'activities' },
      { url: 'http://localhost/api/findings', get: findingsGet, key: 'findings' },
      { url: 'http://localhost/api/migrations', get: migrationsGet, key: 'migrations' },
      { url: 'http://localhost/api/pull-requests', get: pullRequestsGet, key: 'pullRequests' },
    ] as const;

    for (const role of ['owner', 'admin', 'member']) {
      await db.execute('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?', [role, workspace.id, user.id]);
      for (const route of routes) {
        const response = await route.get(new Request(route.url, {
          headers: { cookie: `apiproof_session=${session.id}` },
        }));
        expect(response.status, `${route.url} role=${role}`).toBe(200);
        const payload = await response.json() as Record<string, unknown[]>;
        expect(payload[route.key], `${route.url} role=${role}`).toHaveLength(1);
        if (route.key === 'migrations') expect(JSON.stringify(payload)).not.toContain(REPORT_LEAK_MARKER);
      }
    }

    const detailedFinding = await findingGet(new Request('http://localhost/api/findings/role_finding', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }), { params: Promise.resolve({ id: 'role_finding' }) });
    expect(detailedFinding.status).toBe(200);
    expect(JSON.stringify(await detailedFinding.json())).not.toContain(REPORT_LEAK_MARKER);

    await db.execute('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?', ['owner-like', workspace.id, user.id]);
    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('role_personal_activity', ?, NULL, 'account_updated', 'Personal activity', 'Own account event', ?)
    `, [user.id, now]);
    for (const route of routes) {
      const response = await route.get(new Request(route.url, {
        headers: { cookie: `apiproof_session=${session.id}` },
      }));
      expect(response.status, route.url).toBe(200);
      const payload = await response.json() as Record<string, unknown[]>;
      expect(payload[route.key], route.url).toHaveLength(route.key === 'activities' ? 1 : 0);
      if (route.key === 'activities') {
        expect(payload.activities![0]).toMatchObject({ id: 'role_personal_activity' });
      }
    }

    const outsider = await createUserWithSession('read-outsider@example.com', 'Pass12345!', 'Read Outsider');
    for (const route of routes) {
      const response = await route.get(new Request(route.url, {
        headers: { cookie: `apiproof_session=${outsider.session.id}` },
      }));
      expect(response.status, `${route.url} cross-tenant outsider`).toBe(200);
      const payload = await response.json() as Record<string, unknown[]>;
      expect(payload[route.key], `${route.url} cross-tenant outsider`).toHaveLength(0);
    }

    await db.execute('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?', ['member', workspace.id, user.id]);
    const foreignOwner = await createUserWithSession('foreign-read-owner@example.com', 'Pass12345!', 'Foreign Read Owner');
    const foreignWorkspace = await getDefaultWorkspaceForUser(foreignOwner.user.id);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, created_at)
      VALUES ('foreign_repo', ?, ?, 'foreign-owner', 'foreign-repo', 'foreign-owner/foreign-repo', 'foreign-repo-1', 'main', ?)
    `, [foreignWorkspace.id, foreignOwner.user.id, now]);
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at)
      VALUES ('foreign_scan', 'foreign_repo', '1123456789012345678901234567890123456789', 'completed', 'fixture', ?, ?)
    `, [now, now]);
    await db.execute(`
      INSERT INTO findings (
        id, scan_id, repository_id, usage_id, change_id, provider, title, description,
        severity, confidence, file_path, line_number, symbol, status, reason,
        reason_codes, evidence, created_at
      ) VALUES (
        'foreign_finding', 'foreign_scan', 'foreign_repo', 'foreign_usage', 'foreign_change', 'fixture',
        'Foreign fixture finding', 'Synthetic cross-tenant test record', 'high', 0.99, 'src/secret.ts', 1,
        'foreignFixture()', 'open', 'test', '[]', '{}', ?
      )
    `, [now]);

    const ownFindingResponse = await findingsGet(new Request('http://localhost/api/findings?repositoryId=role_repo', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    expect(ownFindingResponse.status).toBe(200);
    expect((await ownFindingResponse.json() as { findings: Array<{ id: string }> }).findings.map(({ id }) => id)).toEqual(['role_finding']);

    const foreignFindingResponse = await findingsGet(new Request('http://localhost/api/findings?repositoryId=foreign_repo', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    expect(foreignFindingResponse.status).toBe(200);
    const foreignPayload = await foreignFindingResponse.json() as { findings: Array<{ id: string; title: string }> };
    expect(foreignPayload.findings).toEqual([]);
    expect(JSON.stringify(foreignPayload)).not.toContain('Foreign fixture finding');
  });
});
