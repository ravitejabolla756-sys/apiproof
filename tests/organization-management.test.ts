import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser, createWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { resolveWorkspaceForRequest } from '../apps/web/src/lib/server/organization-route.js';
import { POST as setWorkspaceContext } from '../apps/web/src/app/api/workspace/context/route.js';
import { PATCH as updateMemberRoute, DELETE as removeMemberRoute } from '../apps/web/src/app/api/workspace/members/route.js';
import { DELETE as revokeInvitationRoute } from '../apps/web/src/app/api/workspace/invitations/route.js';
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  listOrganizationMembers,
  listWorkspaceAuditEvents,
  listWorkspaceAuditPage,
  removeOrganizationMember,
  revokeWorkspaceInvitation,
  updateMemberRole,
  updateWorkspaceSettings,
} from '../apps/web/src/lib/server/organization-service.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-organization-management-${process.pid}.db`);

describe('workspace administration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'organization-test-secret-at-least-32-characters';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('updates workspace settings and records an attributable audit event', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const updated = await updateWorkspaceSettings(owner.user.id, workspace.id, 'Platform Team', 'platform-team');
    expect(updated).toMatchObject({ name: 'Platform Team', slug: 'platform-team', role: 'owner' });
    const events = await listWorkspaceAuditEvents(owner.user.id, workspace.id);
    expect(events[0]).toMatchObject({ action: 'workspace.updated', actorEmail: 'owner@example.test' });
  });

  it('paginates audit events with a stable cursor and keeps workspace scope', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const otherOwner = await createUserWithSession('other@example.test', 'OtherPassword123!', 'Other');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const otherWorkspace = await getDefaultWorkspaceForUser(otherOwner.user.id);
    for (const [index, createdAt] of ['2026-01-01T00:00:03.000Z', '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:01.000Z'].entries()) {
      await getDatabase().execute(
        `INSERT INTO workspace_audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${index}`, workspace.id, owner.user.id, `test.event.${index}`, 'test', `target_${index}`, '{}', createdAt],
      );
    }
    const first = await listWorkspaceAuditPage(owner.user.id, workspace.id, undefined, 2);
    expect(first.events.map((event) => event.id)).toEqual(['audit_0', 'audit_1']);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await listWorkspaceAuditPage(owner.user.id, workspace.id, first.nextCursor!, 2);
    expect(second.events.map((event) => event.id)).toEqual(['audit_2']);
    expect(second.nextCursor).toBeNull();
    await expect(listWorkspaceAuditPage(owner.user.id, workspace.id, 'not-a-valid-cursor')).rejects.toMatchObject({ code: 'INVALID_AUDIT_CURSOR' });
    await expect(listWorkspaceAuditPage(owner.user.id, otherWorkspace.id)).rejects.toThrow(/access denied/i);
  });

  it('redacts sensitive audit metadata and bounds oversized values', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await getDatabase().execute(
      `INSERT INTO workspace_audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['audit-sensitive', workspace.id, owner.user.id, 'test.sensitive', 'test', 'target-sensitive', JSON.stringify({ token: 'do-not-return', note: 'x'.repeat(600), nested: { password: 'also-do-not-return' } }), '2026-01-01T00:00:00.000Z'],
    );
    await getDatabase().execute(
      `INSERT INTO workspace_audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['audit-malformed', workspace.id, owner.user.id, 'test.malformed', 'test', 'target-malformed', '{not-json', '2026-01-01T00:00:01.000Z'],
    );

    const page = await listWorkspaceAuditPage(owner.user.id, workspace.id);
    const event = page.events.find((item) => item.id === 'audit-sensitive')!;
    expect(event.metadata).toEqual({ token: '[REDACTED]', note: `${'x'.repeat(512)}[TRUNCATED]`, nested: { password: '[REDACTED]' } });
    expect(page.events.find((item) => item.id === 'audit-malformed')?.metadata).toEqual({});
  });

  it('creates a single-use expiring invitation and accepts it only for the invited email', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const invited = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, invited.user.email, 'member');
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.invitation.email).toBe(invited.user.email);

    const accepted = await acceptWorkspaceInvitation(invited.user.id, created.token);
    expect(accepted.id).toBe(workspace.id);
    expect(await listOrganizationMembers(owner.user.id, workspace.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: invited.user.email, role: 'member' }),
    ]));
    await expect(acceptWorkspaceInvitation(invited.user.id, created.token)).rejects.toMatchObject({ code: 'INVITATION_ALREADY_USED' });
  });

  it('returns a stable already-member error when an invitation races membership creation', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const invited = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, invited.user.email, 'member');
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['wsm_existing', workspace.id, invited.user.id, 'member', new Date().toISOString()]);

    await expect(acceptWorkspaceInvitation(invited.user.id, created.token)).rejects.toMatchObject({ code: 'ALREADY_A_MEMBER' });
    expect(await getDatabase().queryOne('SELECT accepted_at FROM workspace_invitations WHERE id = ?', [created.invitation.id])).toEqual({ accepted_at: null });
  });

  it('rotates a pending invitation for resend and revokes the previous token', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const first = await createWorkspaceInvitation(owner.user.id, workspace.id, 'member@example.test', 'member');
    const second = await createWorkspaceInvitation(owner.user.id, workspace.id, 'MEMBER@example.test', 'member');
    const firstRow = await getDatabase().queryOne<{ id: string; token_hash: string; revoked_at: string | null }>(
      'SELECT id, token_hash, revoked_at FROM workspace_invitations WHERE id = ?', [first.invitation.id],
    );
    const secondRow = await getDatabase().queryOne<{ id: string; revoked_at: string | null }>(
      'SELECT id, revoked_at FROM workspace_invitations WHERE id = ?', [second.invitation.id],
    );
    expect(firstRow).toMatchObject({ id: first.invitation.id });
    expect(firstRow!.token_hash).not.toBe(first.token);
    expect(firstRow!.revoked_at).toEqual(expect.any(String));
    expect(secondRow).toMatchObject({ id: second.invitation.id, revoked_at: null });
    await expect(acceptWorkspaceInvitation(owner.user.id, first.token)).rejects.toMatchObject({ code: 'INVITATION_ALREADY_USED' });
  });

  it('records invitation cancellation in the same transaction as revocation', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, 'cancel@example.test', 'member');

    await revokeWorkspaceInvitation(owner.user.id, workspace.id, created.invitation.id);
    expect(await getDatabase().queryOne<{ revoked_at: string | null }>('SELECT revoked_at FROM workspace_invitations WHERE id = ?', [created.invitation.id])).toMatchObject({ revoked_at: expect.any(String) });
    expect(await getDatabase().queryOne<{ action: string; target_id: string }>("SELECT action, target_id FROM workspace_audit_events WHERE action = 'invitation.revoked' AND target_id = ?", [created.invitation.id])).toEqual({ action: 'invitation.revoked', target_id: created.invitation.id });

    const malformed = await revokeInvitationRoute(new Request('https://apiproof.test/api/workspace/invitations', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie: `apiproof_session=${owner.session.id}`, origin: 'https://apiproof.test', host: 'apiproof.test' },
      body: JSON.stringify({ invitationId: 'not valid' }),
    }));
    expect(malformed.status).toBe(400);
  });

  it('rejects an expired invitation without creating membership', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const invited = await createUserWithSession('expired-member@example.test', 'MemberPassword123!', 'Expired Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, invited.user.email, 'member');
    await getDatabase().execute('UPDATE workspace_invitations SET expires_at = ? WHERE id = ?', ['2020-01-01T00:00:00.000Z', created.invitation.id]);

    await expect(acceptWorkspaceInvitation(invited.user.id, created.token)).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    expect(await getDatabase().queryOne('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspace.id, invited.user.id])).toBeUndefined();
  });

  it('protects invitations from email mismatch and retains at least one owner', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const wrongUser = await createUserWithSession('wrong@example.test', 'WrongPassword123!', 'Wrong');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, 'member@example.test', 'member');
    await expect(acceptWorkspaceInvitation(wrongUser.user.id, created.token)).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    const members = await listOrganizationMembers(owner.user.id, workspace.id);
    const ownerMember = members.find((member) => member.userId === owner.user.id)!;
    await expect(updateMemberRole(owner.user.id, workspace.id, ownerMember.userId, 'member')).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
    await expect(removeOrganizationMember(owner.user.id, workspace.id, ownerMember.userId)).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
    expect(await getDatabase().queryOne<{ role: string }>('SELECT role FROM workspace_members WHERE id = ?', [ownerMember.id])).toEqual({ role: 'owner' });
    expect(await getDatabase().queryOne<{ count: number }>("SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND role = 'owner'", [workspace.id])).toEqual({ count: 1 });
  });

  it('allows an owner to promote a member and revoke access with session invalidation', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const member = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['wsm_member', workspace.id, member.user.id, 'member', new Date().toISOString()]);
    const memberRow = (await listOrganizationMembers(owner.user.id, workspace.id)).find((item) => item.userId === member.user.id)!;
    await updateMemberRole(owner.user.id, workspace.id, memberRow.userId, 'owner');
    await removeOrganizationMember(owner.user.id, workspace.id, memberRow.userId);
    expect(await getDatabase().queryOne('SELECT id FROM workspace_members WHERE id = ?', [memberRow.id])).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE user_id = ?', [member.user.id])).toBeUndefined();
  });

  it('uses explicit workspace and user member mutation contracts at the HTTP boundary', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const member = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const otherOwner = await createUserWithSession('other@example.test', 'OtherPassword123!', 'Other');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const otherWorkspace = await getDefaultWorkspaceForUser(otherOwner.user.id);
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['wsm_member', workspace.id, member.user.id, 'member', new Date().toISOString()]);

    const requestHeaders = { 'content-type': 'application/json', cookie: `apiproof_session=${owner.session.id}` };
    const updated = await updateMemberRoute(new Request('https://apiproof.test/api/workspace/members', {
      method: 'PATCH',
      headers: requestHeaders,
      body: JSON.stringify({ workspaceId: workspace.id, userId: member.user.id, role: 'owner' }),
    }));
    expect(updated.status).toBe(200);
    expect((await updated.json() as { members: Array<{ userId: string; role: string }> }).members).toEqual(expect.arrayContaining([expect.objectContaining({ userId: member.user.id, role: 'owner' })]));

    const crossWorkspace = await updateMemberRoute(new Request('https://apiproof.test/api/workspace/members', {
      method: 'PATCH',
      headers: requestHeaders,
      body: JSON.stringify({ workspaceId: otherWorkspace.id, userId: member.user.id, role: 'member' }),
    }));
    expect(crossWorkspace.status).toBe(404);

    const removed = await removeMemberRoute(new Request('https://apiproof.test/api/workspace/members', {
      method: 'DELETE',
      headers: requestHeaders,
      body: JSON.stringify({ workspaceId: workspace.id, userId: member.user.id }),
    }));
    expect(removed.status).toBe(200);
  });

  it('rejects malformed workspace slugs before writing', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await expect(updateWorkspaceSettings(owner.user.id, workspace.id, 'Workspace', 'bad slug')).rejects.toMatchObject({ code: 'INVALID_WORKSPACE_SLUG' });
  });

  it('resolves the selected workspace from a server-validated cookie and falls back after revocation', async () => {
    const owner = await createUserWithSession('context-owner@example.test', 'OwnerPassword123!', 'Context Owner');
    const otherOwner = await createUserWithSession('context-other@example.test', 'OtherPassword123!', 'Other Owner');
    const defaultWorkspace = await getDefaultWorkspaceForUser(owner.user.id);
    const selectedWorkspace = await createWorkspaceForUser(owner.user.id, 'Selected Workspace', 'selected-workspace');
    const otherWorkspace = await getDefaultWorkspaceForUser(otherOwner.user.id);

    const selected = await resolveWorkspaceForRequest(new Request('https://apiproof.test/api/overview', {
      headers: { cookie: `apiproof_workspace_id=${selectedWorkspace.id}` },
    }), owner.user.id);
    expect(selected.id).toBe(selectedWorkspace.id);

    const stale = await resolveWorkspaceForRequest(new Request('https://apiproof.test/api/overview', {
      headers: { cookie: `apiproof_workspace_id=${otherWorkspace.id}` },
    }), owner.user.id);
    expect(stale.id).toBe(defaultWorkspace.id);
    await expect(resolveWorkspaceForRequest(new Request(`https://apiproof.test/api/overview?workspaceId=${otherWorkspace.id}`), owner.user.id))
      .rejects.toThrow(/access denied/i);
    await expect(resolveWorkspaceForRequest(new Request('https://apiproof.test/api/overview?workspaceId=not%20safe'), owner.user.id))
      .rejects.toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('changes workspace context only after membership authorization and emits an httpOnly cookie', async () => {
    const owner = await createUserWithSession('context-route@example.test', 'OwnerPassword123!', 'Context Route');
    const selectedWorkspace = await createWorkspaceForUser(owner.user.id, 'Route Workspace', 'route-workspace');
    const response = await setWorkspaceContext(new Request('https://apiproof.test/api/workspace/context', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${owner.session.id}`,
      },
      body: JSON.stringify({ workspaceId: selectedWorkspace.id }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`apiproof_workspace_id=${selectedWorkspace.id}`);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');

    const forbidden = await setWorkspaceContext(new Request('https://apiproof.test/api/workspace/context', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${owner.session.id}`,
      },
      body: JSON.stringify({ workspaceId: 'ws_not_owned' }),
    }));
    expect(forbidden.status).toBe(404);
  });
});
