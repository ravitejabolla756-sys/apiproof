/**
 * Regression and Authorization tests for Activity page timestamp formatting and API response handling.
 *
 * Covers:
 *   - valid ISO/database timestamp renders human-readable date/time
 *   - timestamp returned by the Activity API (both created_at and timestamp properties)
 *   - missing/null/undefined timestamp renders safe fallback "Unknown time"
 *   - invalid/corrupt timestamp string renders safe fallback "Unknown time"
 *   - User A sees their own workspace repository activity events
 *   - User A sees repository activity created by fellow workspace members
 *   - User A cannot see another workspace's repository activity (tenant isolation)
 *   - Workspace-level events without a repository (repository_id IS NULL) appear when authorized
 *   - LEFT JOIN cannot bypass workspace membership (former members cannot see other workspace's repo events)
 *   - Activity ordering is strictly created_at DESC with LIMIT 50 pagination
 *   - Unauthenticated access returns 401
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { formatActivityTimestamp, type ActivityItem } from '../apps/web/src/lib/activity-utils.js';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { GET as activityGet } from '../apps/web/src/app/api/activity/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-activity-api.db');

describe('Activity Page Timestamp Formatting — formatActivityTimestamp', () => {
  it('formats a valid ISO/database timestamp string into a human-readable date/time', () => {
    const isoTimestamp = '2026-09-29T10:30:00.000Z';
    const formatted = formatActivityTimestamp(isoTimestamp);

    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).not.toBe('Unknown time');
    expect(formatted).toBe(new Date(isoTimestamp).toLocaleString());
  });

  it('formats a valid timestamp returned by the Activity API via created_at', () => {
    const apiActivity: ActivityItem = {
      id: 'act_001',
      type: 'scan_completed',
      title: 'Scan Completed',
      description: 'AST compatibility scan completed successfully.',
      created_at: '2026-09-28T14:15:22.123Z',
      repo_name: 'apiproof-github-fixture',
      repo_full_name: 'ravitejabolla756-sys/apiproof-github-fixture',
    };

    const formatted = formatActivityTimestamp(apiActivity.created_at ?? apiActivity.timestamp);
    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).not.toBe('Unknown time');
    expect(formatted).toBe(new Date('2026-09-28T14:15:22.123Z').toLocaleString());
  });

  it('formats a timestamp when provided via the legacy timestamp property', () => {
    const legacyActivity: ActivityItem = {
      id: 'act_002',
      type: 'repository_connected',
      title: 'Repository Connected',
      description: 'Connected repository.',
      timestamp: '2026-09-27T08:00:00.000Z',
      repo_name: 'Bavio-Ai-v1',
      repo_full_name: 'ravitejabolla756-sys/Bavio-Ai-v1',
    };

    const formatted = formatActivityTimestamp(legacyActivity.created_at ?? legacyActivity.timestamp);
    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).not.toBe('Unknown time');
    expect(formatted).toBe(new Date('2026-09-27T08:00:00.000Z').toLocaleString());
  });

  it('formats numeric epoch millisecond timestamps correctly', () => {
    const epochMs = 1790680000000;
    const formatted = formatActivityTimestamp(epochMs);
    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).not.toBe('Unknown time');
    expect(formatted).toBe(new Date(epochMs).toLocaleString());
  });

  it('returns "Unknown time" when timestamp is null', () => {
    expect(formatActivityTimestamp(null)).toBe('Unknown time');
  });

  it('returns "Unknown time" when timestamp is undefined', () => {
    expect(formatActivityTimestamp(undefined)).toBe('Unknown time');
  });

  it('returns "Unknown time" when timestamp is an empty string', () => {
    expect(formatActivityTimestamp('')).toBe('Unknown time');
  });

  it('returns "Unknown time" when timestamp is an invalid non-date string', () => {
    expect(formatActivityTimestamp('not-a-valid-date')).toBe('Unknown time');
    expect(formatActivityTimestamp('undefined')).toBe('Unknown time');
    expect(formatActivityTimestamp('null')).toBe('Unknown time');
    expect(formatActivityTimestamp('Invalid Date')).toBe('Unknown time');
  });

  it('safely handles missing fields on ActivityItem without throwing or returning "Invalid Date"', () => {
    const itemWithoutTime: ActivityItem = {
      id: 'act_003',
      type: 'github_connected',
      title: 'GitHub Connected',
      description: 'Connected GitHub App installation.',
      repo_name: null,
      repo_full_name: null,
    };

    const formatted = formatActivityTimestamp(itemWithoutTime.created_at ?? itemWithoutTime.timestamp);
    expect(formatted).toBe('Unknown time');
  });
});

describe('Activity API Route Authorization & Tenant Isolation (GET /api/activity)', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'test-secret-at-least-32-chars-long!';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  it('returns 401 Unauthorized when request has no session', async () => {
    const req = new Request('http://localhost/api/activity');
    const res = await activityGet(req);
    expect(res.status).toBe(401);
  });

  it('1. A user can see their own workspace activity events with both created_at and timestamp', async () => {
    const { user, session } = await createUserWithSession('user_a@example.com', 'Pass12345!', 'User A');
    const wsA = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoIdA = `repo_${crypto.randomBytes(6).toString('hex')}`;
    const nowIso = new Date('2026-09-28T12:00:00.000Z').toISOString();

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org-a', 'repo-alpha', 'org-a/repo-alpha', '101', 'main', 'connected', ?)
    `, [repoIdA, wsA.id, user.id, nowIso]);

    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_user_a', ?, ?, 'scan_completed', 'Scan Completed', 'AST scan finished.', ?)
    `, [user.id, repoIdA, nowIso]);

    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const res = await activityGet(req);
    expect(res.status).toBe(200);

    const data = await res.json() as { activities: ActivityItem[] };
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0]?.id).toBe('act_user_a');
    expect(data.activities[0]?.created_at).toBe(nowIso);
    expect(data.activities[0]?.timestamp).toBe(nowIso);
    expect(data.activities[0]?.repo_name).toBe('repo-alpha');
    expect(data.activities[0]?.repository).toBe('repo-alpha');
    expect(data.activities[0]?.repo_full_name).toBe('org-a/repo-alpha');

    // Verify UI timestamp formatter on the API returned data
    const formatted = formatActivityTimestamp(data.activities[0]?.created_at ?? data.activities[0]?.timestamp);
    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).toBe(new Date(nowIso).toLocaleString());
  });

  it('2. A user can see relevant repository activity for their workspace created by fellow members', async () => {
    const { user: owner, session: ownerSession } = await createUserWithSession('owner@example.com', 'Pass12345!', 'Owner');
    const { user: member } = await createUserWithSession('member@example.com', 'Pass12345!', 'Member');
    const ws = await getDefaultWorkspaceForUser(owner.id);
    const db = getDatabase();

    // Add member to owner's workspace
    const nowIso = new Date('2026-09-28T13:00:00.000Z').toISOString();
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wm_member', ?, ?, 'member', ?)
    `, [ws.id, member.id, nowIso]);

    const repoId = `repo_${crypto.randomBytes(6).toString('hex')}`;
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org', 'shared-repo', 'org/shared-repo', '201', 'main', 'connected', ?)
    `, [repoId, ws.id, owner.id, nowIso]);

    // Member creates an activity on the workspace repository
    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_by_member', ?, ?, 'scan_started', 'Member Scan', 'Scan started by member.', ?)
    `, [member.id, repoId, nowIso]);

    // Owner checks activity
    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${ownerSession.id}` },
    });

    const res = await activityGet(req);
    expect(res.status).toBe(200);

    const data = await res.json() as { activities: ActivityItem[] };
    expect(data.activities.some((act) => act.id === 'act_by_member')).toBe(true);
  });

  it('3. A user cannot see another workspace repository activity', async () => {
    const { user: userA, session: sessionA } = await createUserWithSession('alice@example.com', 'Pass12345!', 'Alice');
    const { user: userB } = await createUserWithSession('bob@example.com', 'Pass12345!', 'Bob');
    const wsA = await getDefaultWorkspaceForUser(userA.id);
    const wsB = await getDefaultWorkspaceForUser(userB.id);
    const db = getDatabase();

    const nowIso = new Date('2026-09-28T14:00:00.000Z').toISOString();
    const repoA = `repo_a_${crypto.randomBytes(4).toString('hex')}`;
    const repoB = `repo_b_${crypto.randomBytes(4).toString('hex')}`;

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org-a', 'repo-a', 'org-a/repo-a', '301', 'main', 'connected', ?)
    `, [repoA, wsA.id, userA.id, nowIso]);

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org-b', 'repo-b', 'org-b/repo-b', '302', 'main', 'connected', ?)
    `, [repoB, wsB.id, userB.id, nowIso]);

    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_a', ?, ?, 'scan_started', 'Event A', 'Desc A', ?)
    `, [userA.id, repoA, nowIso]);

    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_b', ?, ?, 'scan_started', 'Event B', 'Desc B', ?)
    `, [userB.id, repoB, nowIso]);

    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${sessionA.id}` },
    });

    const res = await activityGet(req);
    const data = await res.json() as { activities: ActivityItem[] };

    expect(data.activities).toHaveLength(1);
    expect(data.activities[0]?.id).toBe('act_a');
    expect(data.activities.some((act) => act.id === 'act_b')).toBe(false);
  });

  it('4. Workspace-level events without a repository appear when authorized', async () => {
    const { user: userA, session: sessionA } = await createUserWithSession('user_org@example.com', 'Pass12345!', 'User Org');
    const { user: userB } = await createUserWithSession('other_org@example.com', 'Pass12345!', 'Other Org');
    const db = getDatabase();

    const nowIso = new Date('2026-09-28T15:00:00.000Z').toISOString();

    // Event without a repository (e.g. GitHub App installed)
    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_install_a', ?, NULL, 'github_connected', 'GitHub Connected', 'Installed GitHub App.', ?)
    `, [userA.id, nowIso]);

    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_install_b', ?, NULL, 'github_connected', 'GitHub Connected', 'Installed GitHub App.', ?)
    `, [userB.id, nowIso]);

    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${sessionA.id}` },
    });

    const res = await activityGet(req);
    const data = await res.json() as { activities: ActivityItem[] };

    expect(data.activities).toHaveLength(1);
    expect(data.activities[0]?.id).toBe('act_install_a');
    expect(data.activities[0]?.repo_name).toBeNull();
    expect(data.activities.some((act) => act.id === 'act_install_b')).toBe(false);
  });

  it('5. The LEFT JOIN cannot bypass workspace membership for former members', async () => {
    const { user: userA, session: sessionA } = await createUserWithSession('former_member@example.com', 'Pass12345!', 'Former');
    const { user: userB } = await createUserWithSession('workspace_b_owner@example.com', 'Pass12345!', 'B Owner');
    const wsB = await getDefaultWorkspaceForUser(userB.id);
    const db = getDatabase();

    const nowIso = new Date('2026-09-28T16:00:00.000Z').toISOString();
    const repoB = `repo_b_${crypto.randomBytes(4).toString('hex')}`;

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org-b', 'repo-b', 'org-b/repo-b', '401', 'main', 'connected', ?)
    `, [repoB, wsB.id, userB.id, nowIso]);

    // An event on Workspace B's repository where user_id happens to be User A
    // but User A is NOT a member of Workspace B.
    await db.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES ('act_past_event', ?, ?, 'scan_started', 'Past Scan', 'Scan on Repo B.', ?)
    `, [userA.id, repoB, nowIso]);

    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${sessionA.id}` },
    });

    const res = await activityGet(req);
    const data = await res.json() as { activities: ActivityItem[] };

    // User A must NOT see act_past_event because User A is not a member of Workspace B
    expect(data.activities.some((act) => act.id === 'act_past_event')).toBe(false);
    expect(data.activities).toHaveLength(0);
  });

  it('6. Preserves strictly descending chronological order and LIMIT 50', async () => {
    const { user, session } = await createUserWithSession('order_test@example.com', 'Pass12345!', 'Order Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoId = `repo_${crypto.randomBytes(6).toString('hex')}`;
    const baseDate = new Date('2026-09-01T00:00:00.000Z');

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'org', 'repo-order', 'org/repo-order', '501', 'main', 'connected', ?)
    `, [repoId, ws.id, user.id, baseDate.toISOString()]);

    // Insert 60 activity events with incrementing timestamps
    for (let i = 1; i <= 60; i++) {
      const eventDate = new Date(baseDate.getTime() + i * 1000 * 60).toISOString();
      await db.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, 'test_event', ?, 'Description', ?)
      `, [`act_seq_${i}`, user.id, repoId, `Event ${i}`, eventDate]);
    }

    const req = new Request('http://localhost/api/activity', {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const res = await activityGet(req);
    const data = await res.json() as { activities: ActivityItem[] };

    // Max 50 items
    expect(data.activities).toHaveLength(50);

    // Most recent is Event 60
    expect(data.activities[0]?.id).toBe('act_seq_60');
    expect(data.activities[49]?.id).toBe('act_seq_11');

    // Confirm strict descending ordering
    for (let i = 0; i < data.activities.length - 1; i++) {
      const currentTime = new Date(data.activities[i]!.created_at!).getTime();
      const nextTime = new Date(data.activities[i + 1]!.created_at!).getTime();
      expect(currentTime).toBeGreaterThanOrEqual(nextTime);
    }
  });
});
