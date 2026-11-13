import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { memberRevocationMigrations } from '../apps/web/src/lib/server/db/member-revocation-migration.js';
import { organizationMigrations } from '../apps/web/src/lib/server/db/organization-migration.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser, createWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { resolveWorkspaceForRequest } from '../apps/web/src/lib/server/organization-route.js';
import { POST as setWorkspaceContext } from '../apps/web/src/app/api/workspace/context/route.js';
import { GET as listWorkspacesRoute } from '../apps/web/src/app/api/workspaces/route.js';
import { GET as overviewRoute } from '../apps/web/src/app/api/overview/route.js';
import { GET as findingsRoute } from '../apps/web/src/app/api/findings/route.js';
import { GET as pullRequestsRoute } from '../apps/web/src/app/api/pull-requests/route.js';
import { GET as migrationsRoute } from '../apps/web/src/app/api/migrations/route.js';
import { GET as auditRoute } from '../apps/web/src/app/api/workspace/audit/route.js';
import { GET as membersGet, PATCH as updateMemberRoute, DELETE as removeMemberRoute } from '../apps/web/src/app/api/workspace/members/route.js';
import { GET as invitationsGet, DELETE as revokeInvitationRoute } from '../apps/web/src/app/api/workspace/invitations/route.js';
import { GET as settingsGet } from '../apps/web/src/app/api/workspace/settings/route.js';
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
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'organization-test-secret-at-least-32-characters';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
    await organizationMigrations[0]!.up(getDatabase());
    await memberRevocationMigrations[0]!.up(getDatabase());
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

  it('marks audit responses private and non-cacheable at the HTTP boundary', async () => {
    const owner = await createUserWithSession('audit-cache@example.test', 'OwnerPassword123!', 'Audit Cache');
    const response = await auditRoute(new Request('https://apiproof.test/api/workspace/audit', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });

  it('rejects cross-workspace audit reads at the HTTP boundary', async () => {
    const owner = await createUserWithSession('audit-route-owner@example.test', 'OwnerPassword123!', 'Audit Route Owner');
    const otherOwner = await createUserWithSession('audit-route-other@example.test', 'OtherPassword123!', 'Audit Route Other');
    const otherWorkspace = await getDefaultWorkspaceForUser(otherOwner.user.id);
    const response = await auditRoute(new Request(`https://apiproof.test/api/workspace/audit?workspaceId=${otherWorkspace.id}`, {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' });
  });

  it('keeps workspace administration reads private and non-cacheable', async () => {
    const owner = await createUserWithSession('admin-cache@example.test', 'OwnerPassword123!', 'Admin Cache');
    const request = () => new Request('https://apiproof.test/api/workspace/settings', { headers: { cookie: `apiproof_session=${owner.session.id}` } });
    const [settings, members, invitations] = await Promise.all([
      settingsGet(request()),
      membersGet(new Request('https://apiproof.test/api/workspace/members', { headers: { cookie: `apiproof_session=${owner.session.id}` } })),
      invitationsGet(new Request('https://apiproof.test/api/workspace/invitations', { headers: { cookie: `apiproof_session=${owner.session.id}` } })),
    ]);
    for (const response of [settings, members, invitations]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    }
  });

  it('returns a structured unavailable response when optional organization tables are absent', async () => {
    const owner = await createUserWithSession('schema-unavailable@example.test', 'OwnerPassword123!', 'Schema Unavailable');
    await getDatabase().execute('DROP TABLE workspace_invitations');
    const invitations = await invitationsGet(new Request('https://apiproof.test/api/workspace/invitations', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(invitations.status).toBe(503);
    expect(await invitations.json()).toMatchObject({ code: 'ORGANIZATION_SCHEMA_UNAVAILABLE' });

    await getDatabase().execute('DROP TABLE workspace_audit_events');
    const audit = await auditRoute(new Request('https://apiproof.test/api/workspace/audit', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(audit.status).toBe(503);
    expect(await audit.json()).toMatchObject({ code: 'ORGANIZATION_SCHEMA_UNAVAILABLE' });
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
    await expect(removeOrganizationMember(owner.user.id, workspace.id, ownerMember.userId)).rejects.toThrow('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
    expect(await getDatabase().queryOne<{ role: string }>('SELECT role FROM workspace_members WHERE id = ?', [ownerMember.id])).toEqual({ role: 'owner' });
    expect(await getDatabase().queryOne<{ count: number }>("SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND role = 'owner'", [workspace.id])).toEqual({ count: 1 });
  });

  it('allows an owner to promote a member and revoke workspace access while preserving the personal session', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const member = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['wsm_member', workspace.id, member.user.id, 'member', new Date().toISOString()]);
    const memberRow = (await listOrganizationMembers(owner.user.id, workspace.id)).find((item) => item.userId === member.user.id)!;
    await updateMemberRole(owner.user.id, workspace.id, memberRow.userId, 'owner');
    await removeOrganizationMember(owner.user.id, workspace.id, memberRow.userId);
    expect(await getDatabase().queryOne('SELECT id FROM workspace_members WHERE id = ?', [memberRow.id])).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE user_id = ?', [member.user.id])).toBeTruthy();
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
      body: JSON.stringify({ workspaceId: workspace.id, userId: member.user.id, idempotencyKey: 'org-management-http-remove-1' }),
    }));
    expect(removed.status).toBe(200);
  });

  it('returns a typed error for malformed workspace context in the workspace list route', async () => {
    const owner = await createUserWithSession('owner-context@example.test', 'OwnerPassword123!', 'Owner Context');
    const response = await listWorkspacesRoute(new Request('https://apiproof.test/api/workspaces?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('lists only server-authorized workspaces and rejects a cross-tenant active context', async () => {
    const owner = await createUserWithSession('org-list-owner@example.test', 'OwnerPassword123!', 'List Owner');
    const member = await createUserWithSession('org-list-member@example.test', 'MemberPassword123!', 'List Member');
    const otherOwner = await createUserWithSession('org-list-other@example.test', 'OtherPassword123!', 'Other Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const memberDefaultWorkspace = await getDefaultWorkspaceForUser(member.user.id);
    const otherWorkspace = await getDefaultWorkspaceForUser(otherOwner.user.id);
    await getDatabase().execute(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['wsm_org_list_member', workspace.id, member.user.id, 'member', new Date().toISOString()],
    );

    const listed = await listWorkspacesRoute(new Request('https://apiproof.test/api/workspaces', {
      headers: { cookie: `apiproof_session=${member.session.id}` },
    }));
    expect(listed.status).toBe(200);
    const listedBody = await listed.json() as { activeWorkspaceId: string; workspaces: Array<{ id: string; role: string }> };
    expect(listedBody.activeWorkspaceId).toBe(memberDefaultWorkspace.id);
    expect(listedBody.workspaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: memberDefaultWorkspace.id, role: 'owner' }),
      expect.objectContaining({ id: workspace.id, role: 'member' }),
    ]));
    expect(listedBody.workspaces).toHaveLength(2);

    const crossTenant = await listWorkspacesRoute(new Request(`https://apiproof.test/api/workspaces?workspaceId=${otherWorkspace.id}`, {
      headers: { cookie: `apiproof_session=${member.session.id}` },
    }));
    expect(crossTenant.status).toBe(404);
    expect(await crossTenant.json()).toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' });
  });

  it('serializes concurrent default-workspace recovery on the SQLite adapter', async () => {
    const owner = await createUserWithSession('owner-concurrent@example.test', 'OwnerPassword123!', 'Concurrent Owner');
    const workspaces = await Promise.all(Array.from({ length: 5 }, () => getDefaultWorkspaceForUser(owner.user.id)));
    expect(new Set(workspaces.map((workspace) => workspace.id)).size).toBe(1);
    expect(await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) as count FROM workspace_members WHERE user_id = ?', [owner.user.id])).toEqual({ count: 1 });
  });

  it('returns a typed error for malformed workspace context in the overview route', async () => {
    const owner = await createUserWithSession('owner-overview@example.test', 'OwnerPassword123!', 'Owner Overview');
    const response = await overviewRoute(new Request('https://apiproof.test/api/overview?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('returns a typed error for malformed workspace context in the findings route', async () => {
    const owner = await createUserWithSession('owner-findings@example.test', 'OwnerPassword123!', 'Owner Findings');
    const response = await findingsRoute(new Request('https://apiproof.test/api/findings?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('returns a typed error for malformed workspace context in the pull-request route', async () => {
    const owner = await createUserWithSession('owner-pull-requests@example.test', 'OwnerPassword123!', 'Owner Pull Requests');
    const response = await pullRequestsRoute(new Request('https://apiproof.test/api/pull-requests?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('returns a typed error for malformed workspace context in the migrations route', async () => {
    const owner = await createUserWithSession('owner-migrations@example.test', 'OwnerPassword123!', 'Owner Migrations');
    const response = await migrationsRoute(new Request('https://apiproof.test/api/migrations?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${owner.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
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
