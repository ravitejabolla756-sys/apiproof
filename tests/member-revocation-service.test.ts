import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession, createUser, validateSession } from '../apps/web/src/lib/server/auth.js';
import { assertCurrentWorkspaceMembership, getDefaultWorkspaceForUser, requireWorkspaceMember } from '../apps/web/src/lib/server/workspace-service.js';
import { revokeWorkspaceMember } from '../apps/web/src/lib/server/member-revocation.js';
import { GET as getRepository } from '../apps/web/src/app/api/repositories/[id]/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-member-revocation-service.db');

describe('ORG-10 durable member revocation', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  async function addMember(workspaceId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<void> {
    await getDatabase().execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [`wsm_test_${userId}`, workspaceId, userId, role, new Date().toISOString()]);
  }

  it('revokes only the selected workspace and leaves the subject session and other workspace intact', async () => {
    const owner = createUser('org-owner@example.com', 'Pass12345!', 'Org Owner');
    const member = createUser('org-member@example.com', 'Pass12345!', 'Org Member');
    const memberWorkspace = await getDefaultWorkspaceForUser(member.id);
    const ownerWorkspace = await getDefaultWorkspaceForUser(owner.id);
    await addMember(ownerWorkspace.id, member.id);
    const session = createSession(member.id);

    const result = await revokeWorkspaceMember(owner.id, {
      workspaceId: ownerWorkspace.id,
      userId: member.id,
      reason: 'Membership ended',
      idempotencyKey: 'org-10-service-001',
    });

    expect(result.status).toBe('completed');
    expect(result.workspaceId).toBe(ownerWorkspace.id);
    expect(result.subjectMembershipId).toMatch(/^wsm_test_/);
    expect(await getDatabase().queryOne('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ownerWorkspace.id, member.id])).toBeUndefined();
    expect(await requireWorkspaceMember(member.id, memberWorkspace.id)).toMatchObject({ id: memberWorkspace.id, role: 'owner' });
    await expect(requireWorkspaceMember(member.id, ownerWorkspace.id)).rejects.toThrow('Workspace not found or access denied.');
    await expect(assertCurrentWorkspaceMembership(member.id, ownerWorkspace.id)).rejects.toThrow('WORKSPACE_ACCESS_REVOKED');
    expect(validateSession(session.id)?.user.id).toBe(member.id);

    const request = await getDatabase().queryOne<{ status: string; audit_event_id: string; outcome_code: string }>(
      'SELECT status, audit_event_id, outcome_code FROM workspace_member_revocation_requests WHERE id = ?', [result.requestId],
    );
    const event = await getDatabase().queryOne<{ event_type: string; workspace_id: string; subject_user_id: string; actor_user_id: string; payload_json: string }>(
      'SELECT event_type, workspace_id, subject_user_id, actor_user_id, payload_json FROM workspace_security_audit_events WHERE id = ?', [result.eventId],
    );
    expect(request).toMatchObject({ status: 'completed', audit_event_id: result.eventId, outcome_code: 'MEMBERSHIP_REVOKED' });
    expect(event).toMatchObject({
      event_type: 'workspace.member_revocation.v1',
      workspace_id: ownerWorkspace.id,
      subject_user_id: member.id,
      actor_user_id: owner.id,
    });
    expect(JSON.parse(event!.payload_json)).toMatchObject({ eventId: result.eventId, workspaceId: ownerWorkspace.id });
  });

  it('denies a still-authenticated removed member through a workspace-scoped API route', async () => {
    const owner = createUser('route-revoke-owner@example.com', 'Pass12345!', 'Route Owner');
    const member = createUser('route-revoke-member@example.com', 'Pass12345!', 'Route Member');
    const workspace = await getDefaultWorkspaceForUser(owner.id);
    await addMember(workspace.id, member.id);
    const session = createSession(member.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES (?, ?, ?, 'route-org', 'private-repo', 'route-org/private-repo', 'route-gh-1', 'main', 'connected', 'connected', 'active', ?)
    `, ['org10_route_repo', workspace.id, owner.id, now]);
    const request = () => new Request('http://localhost/api/repositories/org10_route_repo', {
      headers: { cookie: `apiproof_session=${session.id}` },
    });
    const params = { params: Promise.resolve({ id: 'org10_route_repo' }) };

    const before = await getRepository(request(), params);
    expect(before.status).toBe(200);
    expect((await before.json() as { repository: { id: string } }).repository.id).toBe('org10_route_repo');

    await revokeWorkspaceMember(owner.id, {
      workspaceId: workspace.id,
      userId: member.id,
      idempotencyKey: 'org-10-route-revocation',
    });

    expect(validateSession(session.id)?.user.id).toBe(member.id);
    const after = await getRepository(request(), params);
    expect(after.status).toBe(404);
    expect(JSON.stringify(await after.json())).not.toContain('route-org/private-repo');
  });

  it('is idempotent and rejects a reused key for a different subject', async () => {
    const owner = createUser('idempotent-owner@example.com', 'Pass12345!', 'Owner');
    const member = createUser('idempotent-member@example.com', 'Pass12345!', 'Member');
    const otherMember = createUser('idempotent-other@example.com', 'Pass12345!', 'Other');
    const workspace = await getDefaultWorkspaceForUser(owner.id);
    await addMember(workspace.id, member.id);
    await addMember(workspace.id, otherMember.id);
    const request = { workspaceId: workspace.id, userId: member.id, reason: 'Duplicate-safe', idempotencyKey: 'org-10-idempotent-001' };

    const first = await revokeWorkspaceMember(owner.id, request);
    const repeated = await revokeWorkspaceMember(owner.id, request);

    expect(repeated).toEqual(first);
    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_security_audit_events WHERE workspace_id = ?', [workspace.id],
    )).toMatchObject({ count: 1 });
    await expect(revokeWorkspaceMember(owner.id, { ...request, userId: otherMember.id })).rejects.toThrow('REVOCATION_IDEMPOTENCY_CONFLICT');
  });

  it('fails closed for unauthorized, cross-tenant and final-owner mutations', async () => {
    const owner = createUser('guard-owner@example.com', 'Pass12345!', 'Owner');
    const member = createUser('guard-member@example.com', 'Pass12345!', 'Member');
    const outsider = createUser('guard-outsider@example.com', 'Pass12345!', 'Outsider');
    const workspace = await getDefaultWorkspaceForUser(owner.id);
    const outsiderWorkspace = await getDefaultWorkspaceForUser(outsider.id);
    await addMember(workspace.id, member.id);

    await expect(revokeWorkspaceMember(member.id, {
      workspaceId: workspace.id, userId: owner.id, idempotencyKey: 'org-10-member-denied',
    })).rejects.toThrow('WORKSPACE_CAPABILITY_DENIED');
    await expect(revokeWorkspaceMember(outsider.id, {
      workspaceId: workspace.id, userId: member.id, idempotencyKey: 'org-10-outsider-denied',
    })).rejects.toThrow('WORKSPACE_ACCESS_DENIED');
    await expect(revokeWorkspaceMember(owner.id, {
      workspaceId: outsiderWorkspace.id, userId: outsider.id, idempotencyKey: 'org-10-cross-tenant',
    })).rejects.toThrow('WORKSPACE_ACCESS_DENIED');
    await expect(revokeWorkspaceMember(owner.id, {
      workspaceId: workspace.id, userId: owner.id, idempotencyKey: 'org-10-self-leave',
    })).rejects.toThrow('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');

    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_security_audit_events',
    )).toMatchObject({ count: 0 });
  });

  it('protects the final owner and serializes concurrent removals', async () => {
    const owner = createUser('race-owner@example.com', 'Pass12345!', 'Owner');
    const member = createUser('race-member@example.com', 'Pass12345!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.id);
    await addMember(workspace.id, member.id);

    const attempts = await Promise.allSettled([
      revokeWorkspaceMember(owner.id, { workspaceId: workspace.id, userId: member.id, idempotencyKey: 'org-10-race-a' }),
      revokeWorkspaceMember(owner.id, { workspaceId: workspace.id, userId: member.id, idempotencyKey: 'org-10-race-b' }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_security_audit_events WHERE workspace_id = ?', [workspace.id],
    )).toMatchObject({ count: 1 });

    await expect(revokeWorkspaceMember(owner.id, {
      workspaceId: workspace.id, userId: owner.id, idempotencyKey: 'org-10-final-owner',
    })).rejects.toThrow('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
  });

  it('preserves an owner when two owners concurrently attempt to remove each other', async () => {
    const ownerA = createUser('mutual-owner-a@example.com', 'Pass12345!', 'Owner A');
    const ownerB = createUser('mutual-owner-b@example.com', 'Pass12345!', 'Owner B');
    const workspace = await getDefaultWorkspaceForUser(ownerA.id);
    await addMember(workspace.id, ownerB.id, 'owner');

    const attempts = await Promise.allSettled([
      revokeWorkspaceMember(ownerA.id, {
        workspaceId: workspace.id,
        userId: ownerB.id,
        idempotencyKey: 'org-10-mutual-owner-a',
      }),
      revokeWorkspaceMember(ownerB.id, {
        workspaceId: workspace.id,
        userId: ownerA.id,
        idempotencyKey: 'org-10-mutual-owner-b',
      }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await getDatabase().query<{ user_id: string; role: string }>(
      'SELECT user_id, role FROM workspace_members WHERE workspace_id = ?', [workspace.id],
    )).toEqual([expect.objectContaining({ role: 'owner' })]);
    expect(await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_security_audit_events WHERE workspace_id = ?', [workspace.id],
    )).toMatchObject({ count: 1 });
  });
});
