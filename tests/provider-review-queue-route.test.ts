import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../apps/web/src/app/api/provider-rules/seed/route.js';
import { GET as getProviderRules } from '../apps/web/src/app/api/provider-rules/route.js';
import { PATCH as editProviderRule } from '../apps/web/src/app/api/provider-rules/[candidateId]/edit/route.js';
import { POST as reviewProviderRule } from '../apps/web/src/app/api/provider-rules/[candidateId]/review/route.js';
import { POST as testProviderRule } from '../apps/web/src/app/api/provider-rules/[candidateId]/test/route.js';
import { AUTH_COOKIE_NAME, createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-review-queue-route.db');

describe('provider review queue bootstrap route', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('requires an authenticated owner and rejects cross-site mutations', async () => {
    const unauthenticated = await POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    }));
    expect(unauthenticated.status).toBe(403);
    expect(await unauthenticated.json()).toMatchObject({ code: 'CSRF_REJECTED' });

    const authenticated = await POST(new Request('https://myowl.example/api/provider-rules/seed', { method: 'POST' }));
    expect(authenticated.status).toBe(401);
    expect(await authenticated.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('seeds the official queue through the owner session and is idempotent', async () => {
    const { session } = await createUserWithSession('queue-owner@example.com', 'Pass1234!', 'Queue Owner');
    const request = () => POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { cookie: `${AUTH_COOKIE_NAME}=${session.id}` },
    }));

    const first = await request();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, candidates: 50, safety: expect.stringContaining('needs_review') });

    const second = await request();
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, candidates: 0, skippedExisting: 50 });
  });

  it('returns a generic authorization denial for member and unknown persisted roles without seeding', async () => {
    const member = await createUserWithSession('queue-member@example.com', 'Pass1234!', 'Queue Member');
    const memberWorkspace = await getDefaultWorkspaceForUser(member.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['member', memberWorkspace.id, member.user.id],
    );
    const memberResponse = await POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { cookie: `${AUTH_COOKIE_NAME}=${member.session.id}` },
    }));
    expect(memberResponse.status).toBe(403);
    expect(await memberResponse.json()).toMatchObject({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' });

    const unknown = await createUserWithSession('queue-unknown-role@example.com', 'Pass1234!', 'Unknown Role');
    const unknownWorkspace = await getDefaultWorkspaceForUser(unknown.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', unknownWorkspace.id, unknown.user.id],
    );
    const unknownResponse = await POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { cookie: `${AUTH_COOKIE_NAME}=${unknown.session.id}` },
    }));
    expect(unknownResponse.status).toBe(403);
    expect(await unknownResponse.json()).toMatchObject({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' });

    const count = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM provider_rule_candidates');
    expect(Number(count?.count)).toBe(0);
  });

  it('fails closed for an unknown persisted role across every privileged provider-rule route', async () => {
    const unknown = await createUserWithSession('queue-unknown-routes@example.com', 'Pass1234!', 'Unknown Role Routes');
    const workspace = await getDefaultWorkspaceForUser(unknown.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, unknown.user.id],
    );
    const headers = { cookie: `${AUTH_COOKIE_NAME}=${unknown.session.id}` };
    const candidateContext = { params: Promise.resolve({ candidateId: 'candidate-not-found' }) };
    const responses = await Promise.all([
      getProviderRules(new Request('https://myowl.example/api/provider-rules', { headers })),
      POST(new Request('https://myowl.example/api/provider-rules/seed', { method: 'POST', headers })),
      editProviderRule(new Request('https://myowl.example/api/provider-rules/candidate-not-found/edit', {
        method: 'PATCH', headers, body: JSON.stringify({ title: 'unauthorized' }),
      }), candidateContext),
      reviewProviderRule(new Request('https://myowl.example/api/provider-rules/candidate-not-found/review', {
        method: 'POST', headers, body: JSON.stringify({ decision: 'reject', notes: 'unauthorized' }),
      }), candidateContext),
      testProviderRule(new Request('https://myowl.example/api/provider-rules/candidate-not-found/test', {
        method: 'POST', headers, body: JSON.stringify({ code: 'export const sample = true;' }),
      }), candidateContext),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' });
    }
    const candidates = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM provider_rule_candidates');
    expect(Number(candidates?.count)).toBe(0);
  });
});
