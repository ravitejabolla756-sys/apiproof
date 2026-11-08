import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { POST as checkoutPost } from '../apps/web/src/app/api/billing/checkout/route.js';
import { POST as portalPost } from '../apps/web/src/app/api/billing/portal/route.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-member2-billing-boundaries-${process.pid}.db`);

describe('beta billing boundaries', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'billing-boundary-test-secret-at-least-32-chars';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('blocks paid checkout before contacting the provider', async () => {
    const account = await createUserWithSession('billing@example.test', 'BillingPassword123!', 'Billing User');
    const response = await checkoutPost(new Request('https://apiproof.test/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `apiproof_session=${account.session.id}` },
      body: JSON.stringify({ planId: 'pro' }),
    }));
    expect(response.status).toBe(403);
    expect((await response.json() as { error: string }).error).toContain('cannot be purchased');
  });

  it('does not expose a simulated customer portal during beta', async () => {
    const account = await createUserWithSession('billing@example.test', 'BillingPassword123!', 'Billing User');
    const response = await portalPost(new Request('https://apiproof.test/api/billing/portal', {
      method: 'POST',
      headers: { cookie: `apiproof_session=${account.session.id}` },
    }));
    expect(response.status).toBe(403);
    expect((await response.json() as { error: string }).error).toContain('not enabled');
  });

  it('blocks billing management for workspace members before the beta boundary', async () => {
    const owner = await createUserWithSession('billing-owner@example.test', 'BillingPassword123!', 'Billing Owner');
    const member = await createUserWithSession('billing-member@example.test', 'BillingPassword123!', 'Billing Member');
    const workspace = await getDefaultWorkspaceForUser(owner.user.id);
    await getDatabase().execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', ['billing-member', workspace.id, member.user.id, 'member', new Date().toISOString()]);
    const headers = { cookie: `apiproof_session=${member.session.id}; apiproof_workspace_id=${workspace.id}` };

    const checkout = await checkoutPost(new Request('https://apiproof.test/api/billing/checkout', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ planId: 'pro' }) }));
    expect(checkout.status).toBe(403);
    expect(await checkout.json()).toMatchObject({ error: expect.stringContaining('BILLING_OWNER_REQUIRED') });

    const portal = await portalPost(new Request('https://apiproof.test/api/billing/portal', { method: 'POST', headers }));
    expect(portal.status).toBe(403);
    expect(await portal.json()).toMatchObject({ error: expect.stringContaining('BILLING_OWNER_REQUIRED') });
  });

  it('returns a typed client error for malformed explicit workspace contexts', async () => {
    const account = await createUserWithSession('billing-context@example.test', 'BillingPassword123!', 'Billing Context');
    const headers = { cookie: `apiproof_session=${account.session.id}` };

    const checkout = await checkoutPost(new Request('https://apiproof.test/api/billing/checkout?workspaceId=not%20safe', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'pro' }),
    }));
    expect(checkout.status).toBe(400);
    expect(await checkout.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });

    const portal = await portalPost(new Request('https://apiproof.test/api/billing/portal?workspaceId=not%20safe', {
      method: 'POST',
      headers,
    }));
    expect(portal.status).toBe(400);
    expect(await portal.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });
});
