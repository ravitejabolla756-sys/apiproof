import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import {
  getDefaultWorkspaceForUser,
  requireWorkspaceCapability,
  requireWorkspaceMember,
} from '../apps/web/src/lib/server/workspace-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-workspace-policy-integration.db');

describe('ORG-05 — workspace policy integration boundaries', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* test cleanup */ }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('fails closed when a persisted workspace role is outside the approved vocabulary', async () => {
    const user = createUser('org-policy-invalid-role@example.com', 'Pass1234!', 'Policy Test');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['superuser', workspace.id, user.id],
    );

    await expect(requireWorkspaceMember(user.id, workspace.id)).rejects.toThrow('WORKSPACE_ROLE_INVALID');
  });

  it('enforces member capabilities through the database-backed authorization boundary', async () => {
    const owner = createUser('org-policy-owner@example.com', 'Pass1234!', 'Owner');
    const member = createUser('org-policy-member@example.com', 'Pass1234!', 'Member');
    const workspace = await getDefaultWorkspaceForUser(owner.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'member', ?)
    `, ['org_policy_member', workspace.id, member.id, now]);

    await expect(requireWorkspaceCapability(member.id, workspace.id, 'workspace:read')).resolves.toMatchObject({
      id: workspace.id,
      role: 'member',
    });
    await expect(requireWorkspaceCapability(member.id, workspace.id, 'repository:write')).resolves.toMatchObject({
      id: workspace.id,
      role: 'member',
    });
    await expect(requireWorkspaceCapability(member.id, workspace.id, 'workspace:manage_members'))
      .rejects.toThrow('WORKSPACE_CAPABILITY_DENIED');
    await expect(requireWorkspaceCapability(member.id, workspace.id, 'provider_rules:review'))
      .rejects.toThrow('WORKSPACE_CAPABILITY_DENIED');
  });

  it('does not let a member from another workspace cross the capability boundary', async () => {
    const ownerA = createUser('org-policy-owner-a@example.com', 'Pass1234!', 'Owner A');
    const ownerB = createUser('org-policy-owner-b@example.com', 'Pass1234!', 'Owner B');
    const workspaceA = await getDefaultWorkspaceForUser(ownerA.id);
    const workspaceB = await getDefaultWorkspaceForUser(ownerB.id);

    await expect(requireWorkspaceCapability(ownerB.id, workspaceA.id, 'workspace:read'))
      .rejects.toThrow('Workspace not found or access denied');
    await expect(requireWorkspaceCapability(ownerA.id, workspaceB.id, 'workspace:manage_members'))
      .rejects.toThrow('Workspace not found or access denied');
  });
});
