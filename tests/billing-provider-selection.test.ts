import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession, createUserAsync } from '../apps/web/src/lib/server/auth.js';
import { POST as checkoutPost } from '../apps/web/src/app/api/billing/checkout/route.js';
import { POST as portalPost } from '../apps/web/src/app/api/billing/portal/route.js';
import { GET as subscriptionGet } from '../apps/web/src/app/api/billing/subscription/route.js';
import { billingPortalAvailability } from '../apps/web/src/lib/billing-portal-contract.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-billing-provider-selection-${process.pid}.db`);

describe('BILL-02 provider-neutral billing gates', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('rejects unauthenticated checkout, portal and subscription requests', async () => {
    const checkout = await checkoutPost(new Request('http://localhost/api/billing/checkout', { method: 'POST', body: JSON.stringify({ planId: 'pro' }) }));
    const portal = await portalPost(new Request('http://localhost/api/billing/portal', { method: 'POST' }));
    const subscription = await subscriptionGet(new Request('http://localhost/api/billing/subscription'));
    expect(checkout.status).toBe(401);
    expect(portal.status).toBe(401);
    expect(subscription.status).toBe(401);
  });

  it('keeps paid checkout blocked and portal unavailable after authentication', async () => {
    const user = await createUserAsync('bill02-owner@example.test', 'OriginalPassword123!', 'Billing Owner');
    const session = createSession(user.id);
    const headers = { cookie: `apiproof_session=${session.id}` };
    const checkout = await checkoutPost(new Request('http://localhost/api/billing/checkout', { method: 'POST', headers, body: JSON.stringify({ planId: 'pro' }) }));
    const portal = await portalPost(new Request('http://localhost/api/billing/portal', { method: 'POST', headers }));
    expect(checkout.status).toBe(403);
    expect((await checkout.json() as { error: string }).error).toContain('BILLING_NOT_AVAILABLE');
    expect(portal.status).toBe(403);
    expect(await portal.json()).toEqual({ error: 'Billing portal is unavailable in this beta.', code: billingPortalAvailability.code });
  });

  it('returns a safe authorization denial for a non-billing workspace member', async () => {
    await createUserAsync('bill02-owner-member@example.test', 'OriginalPassword123!', 'Billing Owner');
    const member = await createUserAsync('bill02-member@example.test', 'OriginalPassword123!', 'Billing Member');
    const memberSession = createSession(member.id);
    const workspace = await getDatabase().queryOne<{ id: string }>(
      'SELECT id FROM workspaces WHERE slug LIKE ?', [`bill02-owner-member-%`],
    );
    expect(workspace).toBeTruthy();
    const memberWorkspace = await getDatabase().queryOne<{ id: string }>(
      'SELECT id FROM workspaces WHERE slug LIKE ?', [`bill02-member-%`],
    );
    await getDatabase().execute('DELETE FROM workspaces WHERE id = ?', [memberWorkspace?.id]);
    await getDatabase().execute(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['bill02_member_membership', workspace!.id, member.id, 'member', new Date().toISOString()],
    );

    const response = await checkoutPost(new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { cookie: `apiproof_session=${memberSession.id}` },
      body: JSON.stringify({ planId: 'pro' }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Billing access denied.', code: 'WORKSPACE_BILLING_ACCESS_DENIED' });
  });
});
