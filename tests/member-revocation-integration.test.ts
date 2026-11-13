import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { memberRevocationMigrations } from '../apps/web/src/lib/server/db/member-revocation-migration.js';
import { organizationMigrations } from '../apps/web/src/lib/server/db/organization-migration.js';
import { revokeWorkspaceMember } from '../apps/web/src/lib/server/member-revocation.js';

const paths: string[] = [];

afterEach(() => {
  try { closeDatabase(); } catch { /* disposable test cleanup */ }
  for (const dbPath of paths.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(`${dbPath}${suffix}`, { force: true }); } catch { /* disposable test cleanup */ }
    }
  }
  delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
});

async function fixture() {
  process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
  const dbPath = path.join(os.tmpdir(), `apiproof-revocation-${crypto.randomUUID()}.db`);
  paths.push(dbPath);
  const raw = initDatabase(dbPath);
  const db = getDatabase();
  await memberRevocationMigrations[0]!.up(db);
  await organizationMigrations[0]!.up(db);
  const now = new Date().toISOString();
  raw.exec(`
    INSERT INTO users (id, email, password_hash, name, created_at) VALUES
      ('usr_owner', 'owner@example.test', 'hash', 'Owner', '${now}'),
      ('usr_member', 'member@example.test', 'hash', 'Member', '${now}'),
      ('usr_other', 'other@example.test', 'hash', 'Other', '${now}');
    INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES
      ('ws_primary', 'Primary', 'primary', '${now}', '${now}'),
      ('ws_other', 'Other', 'other', '${now}', '${now}');
    INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES
      ('wsm_owner', 'ws_primary', 'usr_owner', 'owner', '${now}'),
      ('wsm_member', 'ws_primary', 'usr_member', 'member', '${now}'),
      ('wsm_other', 'ws_other', 'usr_member', 'owner', '${now}');
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES
      ('sess_member_primary', 'usr_member', '${now}', '${now}'),
      ('sess_member_other', 'usr_member', '${now}', '${now}');
  `);
  return { raw, db };
}

describe('ORG-10 integrated revocation backend', () => {
  it('removes only the selected workspace membership and preserves sessions/other membership', async () => {
    const { raw } = await fixture();
    const result = await revokeWorkspaceMember('usr_owner', {
      workspaceId: 'ws_primary', userId: 'usr_member', reason: 'offboarding', idempotencyKey: 'key-1',
    });
    expect(result.status).toBe('completed');
    expect(raw.prepare('SELECT id FROM workspace_members WHERE id = ?').get('wsm_member')).toBeUndefined();
    expect(raw.prepare('SELECT id FROM workspace_members WHERE id = ?').get('wsm_other')).toBeTruthy();
    expect(raw.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('usr_member')).toEqual({ count: 2 });
    expect(raw.prepare('SELECT event_type, workspace_id, subject_user_id FROM workspace_security_audit_events').all()).toEqual([
      { event_type: 'workspace.member_revocation.v1', workspace_id: 'ws_primary', subject_user_id: 'usr_member' },
    ]);
  });

  it('invalidates only pending invitations for the removed email in the selected workspace', async () => {
    const { raw } = await fixture();
    const now = new Date().toISOString();
    raw.exec(`
      INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, token_hash, expires_at, created_at)
      VALUES ('invite-primary', 'ws_primary', 'usr_owner', 'MEMBER@example.test', 'member', 'hash-primary', '${now}', '${now}');
      INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, token_hash, expires_at, created_at)
      VALUES ('invite-other', 'ws_other', 'usr_member', 'member@example.test', 'member', 'hash-other', '${now}', '${now}');
      INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, token_hash, expires_at, accepted_at, created_at)
      VALUES ('invite-accepted', 'ws_primary', 'usr_owner', 'member@example.test', 'member', 'hash-accepted', '${now}', '${now}', '${now}');
    `);

    await revokeWorkspaceMember('usr_owner', {
      workspaceId: 'ws_primary', userId: 'usr_member', idempotencyKey: 'key-invitation-invalidation',
    });

    expect(raw.prepare('SELECT revoked_at FROM workspace_invitations WHERE id = ?').get('invite-primary')).toMatchObject({ revoked_at: expect.any(String) });
    expect(raw.prepare('SELECT revoked_at FROM workspace_invitations WHERE id = ?').get('invite-other')).toEqual({ revoked_at: null });
    expect(raw.prepare('SELECT accepted_at, revoked_at FROM workspace_invitations WHERE id = ?').get('invite-accepted')).toMatchObject({ accepted_at: expect.any(String), revoked_at: null });
    expect(raw.prepare("SELECT action, target_id, metadata_json FROM workspace_audit_events WHERE action = 'member.pending_invitations_invalidated'").get()).toMatchObject({ action: 'member.pending_invitations_invalidated', target_id: 'usr_member', metadata_json: JSON.stringify({ invalidatedCount: 1 }) });
  });

  it('rejects an unauthorized actor and protects the final owner', async () => {
    const first = await fixture();
    await expect(revokeWorkspaceMember('usr_member', {
      workspaceId: 'ws_primary', userId: 'usr_owner', idempotencyKey: 'key-unauthorized',
    })).rejects.toThrow('WORKSPACE_CAPABILITY_DENIED');
    first.raw.prepare("DELETE FROM workspace_members WHERE user_id = 'usr_member' AND workspace_id = 'ws_primary'").run();
    await expect(revokeWorkspaceMember('usr_owner', {
      workspaceId: 'ws_primary', userId: 'usr_owner', idempotencyKey: 'key-self',
    })).rejects.toThrow('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
  });

  it('returns the same result for repeated idempotent requests and rejects conflicting reuse', async () => {
    await fixture();
    const request = { workspaceId: 'ws_primary', userId: 'usr_member', idempotencyKey: 'key-repeat' };
    const first = await revokeWorkspaceMember('usr_owner', request);
    const second = await revokeWorkspaceMember('usr_owner', request);
    expect(second).toEqual(first);
    await expect(revokeWorkspaceMember('usr_owner', { ...request, userId: 'usr_other' })).rejects.toThrow('REVOCATION_IDEMPOTENCY_CONFLICT');
  });

  it.todo('invalidates pending invitations transactionally after invitation service integration');
  it.todo('revalidates queued-job membership before privileged execution after revocation');
  it.todo('rejects stale workspace context after revocation through the integrated route');
});
