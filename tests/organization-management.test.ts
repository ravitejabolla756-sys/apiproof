import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  listOrganizationMembers,
  listWorkspaceAuditEvents,
  removeOrganizationMember,
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

  it('protects invitations from email mismatch and retains at least one owner', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const wrongUser = await createUserWithSession('wrong@example.test', 'WrongPassword123!', 'Wrong');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    const created = await createWorkspaceInvitation(owner.user.id, workspace.id, 'member@example.test', 'member');
    await expect(acceptWorkspaceInvitation(wrongUser.user.id, created.token)).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    const members = await listOrganizationMembers(owner.user.id, workspace.id);
    const ownerMember = members.find((member) => member.userId === owner.user.id)!;
    await expect(updateMemberRole(owner.user.id, workspace.id, ownerMember.id, 'member')).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
    await expect(removeOrganizationMember(owner.user.id, workspace.id, ownerMember.id)).rejects.toMatchObject({ code: 'LAST_OWNER_REQUIRED' });
  });

  it('allows an owner to promote a member and revoke access with session invalidation', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const member = await createUserWithSession('member@example.test', 'MemberPassword123!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['wsm_member', workspace.id, member.user.id, 'member', new Date().toISOString()]);
    const memberRow = (await listOrganizationMembers(owner.user.id, workspace.id)).find((item) => item.userId === member.user.id)!;
    await updateMemberRole(owner.user.id, workspace.id, memberRow.id, 'owner');
    await removeOrganizationMember(owner.user.id, workspace.id, memberRow.id);
    expect(await getDatabase().queryOne('SELECT id FROM workspace_members WHERE id = ?', [memberRow.id])).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE user_id = ?', [member.user.id])).toBeUndefined();
  });

  it('rejects malformed workspace slugs before writing', async () => {
    const owner = await createUserWithSession('owner@example.test', 'OwnerPassword123!', 'Owner');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await expect(updateWorkspaceSettings(owner.user.id, workspace.id, 'Workspace', 'bad slug')).rejects.toMatchObject({ code: 'INVALID_WORKSPACE_SLUG' });
  });
});
