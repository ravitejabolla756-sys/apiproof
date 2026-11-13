import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DELETE, GET } from '../apps/web/src/app/api/workspace/members/route.js';
import { createSession, createUser } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { memberRevocationMigrations } from '../apps/web/src/lib/server/db/member-revocation-migration.js';

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
  const dbPath = path.join(os.tmpdir(), `apiproof-org10-route-${crypto.randomUUID()}.db`);
  paths.push(dbPath);
  const raw = initDatabase(dbPath);
  const db = getDatabase();
  await memberRevocationMigrations[0]!.up(db);
  const owner = createUser('org10-owner@example.test', 'password-123', 'Owner');
  const member = createUser('org10-member@example.test', 'password-123', 'Member');
  const ownerSession = createSession(owner.id);
  const ownerMembership = await db.queryOne<{ workspace_id: string }>('SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1', [owner.id]);
  if (!ownerMembership) throw new Error('fixture owner membership missing');
  await db.execute(
    'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
    ['org10-route-member', ownerMembership.workspace_id, member.id, 'member', new Date().toISOString()],
  );
  const memberSession = createSession(member.id);
  return { raw, workspaceId: ownerMembership.workspace_id, ownerSession, memberSession, memberId: member.id };
}

function request(workspaceId: string, sessionId: string, body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/workspace/members', {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      cookie: `apiproof_session=${sessionId}`,
      origin: 'http://localhost',
      host: 'localhost',
    },
    body: JSON.stringify({ workspaceId, ...body }),
  });
}

describe('DELETE /api/workspace/members', () => {
  it('revokes only the selected membership and returns the approved success shape', async () => {
    const { raw, workspaceId, ownerSession, memberSession, memberId } = await fixture();
    const response = await DELETE(request(workspaceId, ownerSession.id, { userId: memberId, idempotencyKey: 'route-key' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, revocation: { workspaceId, subjectUserId: memberId, status: 'completed' } });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, memberId)).toEqual({ count: 0 });

    const staleContext = await GET(new Request('http://localhost/api/workspace/members', {
      headers: { cookie: `apiproof_session=${memberSession.id}; apiproof_workspace_id=${workspaceId}` },
    }));
    expect(staleContext.status).toBe(200);
    expect((await staleContext.json() as { workspace: { id: string } }).workspace.id).not.toBe(workspaceId);

    const explicitRevokedWorkspace = await GET(new Request(`http://localhost/api/workspace/members?workspaceId=${workspaceId}`, {
      headers: { cookie: `apiproof_session=${memberSession.id}` },
    }));
    expect(explicitRevokedWorkspace.status).toBe(404);
  });

  it('rejects cross-site requests before authentication or mutation', async () => {
    const { workspaceId, ownerSession, memberId } = await fixture();
    const crossSite = request(workspaceId, ownerSession.id, { userId: memberId, idempotencyKey: 'route-csrf' });
    crossSite.headers.set('sec-fetch-site', 'cross-site');
    const response = await DELETE(crossSite);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('requires an idempotency key instead of silently making retries non-idempotent', async () => {
    const { workspaceId, ownerSession, memberId } = await fixture();
    const response = await DELETE(request(workspaceId, ownerSession.id, { userId: memberId }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'REVOCATION_IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects malformed payloads without reaching the revocation service', async () => {
    const { workspaceId, ownerSession } = await fixture();
    const response = await DELETE(request(workspaceId, ownerSession.id, { userId: 42, idempotencyKey: 'route-invalid' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST_PAYLOAD' });
  });
});
