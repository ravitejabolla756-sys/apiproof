import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession } from '../apps/web/src/lib/server/auth.js';
import { GET as getInvoiceHistory } from '../apps/web/src/app/api/billing/invoices/route.js';
import { getAuthorizedWorkspaceInvoiceHistory } from '../apps/web/src/lib/server/billing/invoice-history.js';
import { unavailableInvoiceHistoryAdapter } from '../apps/web/src/lib/invoice-history-contract.js';

const dbPaths: string[] = [];

afterEach(() => {
  try { closeDatabase(); } catch { /* disposable test cleanup */ }
  for (const dbPath of dbPaths.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(`${dbPath}${suffix}`, { force: true }); } catch { /* disposable test cleanup */ }
    }
  }
  delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
});

function authorizedFixture(): void {
  process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
  const dbPath = path.join(os.tmpdir(), `apiproof-invoice-${crypto.randomUUID()}.db`);
  dbPaths.push(dbPath);
  const db = initDatabase(dbPath);
  const now = new Date().toISOString();
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, created_at) VALUES
      ('usr_billing_owner', 'owner@example.test', 'hash', 'Owner', '${now}'),
      ('usr_billing_member', 'member@example.test', 'hash', 'Member', '${now}');
    INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES
      ('ws_billing', 'Billing', 'billing', '${now}', '${now}'),
      ('ws_other', 'Other', 'other', '${now}', '${now}');
    INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES
      ('wsm_billing_owner', 'ws_billing', 'usr_billing_owner', 'owner', '${now}'),
      ('wsm_billing_member', 'ws_billing', 'usr_billing_member', 'member', '${now}');
  `);
}

describe('invoice history backend boundary', () => {
  it('has an explicit provider-unavailable result and never fabricates invoices', async () => {
    await expect(unavailableInvoiceHistoryAdapter.load()).resolves.toEqual({
      status: 'unavailable',
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'Invoice history is unavailable in the free beta. No provider-backed invoices or paid entitlements are represented here.',
    });
  });

  it('authorizes an owner before returning the unavailable provider state', async () => {
    authorizedFixture();
    await expect(getAuthorizedWorkspaceInvoiceHistory('usr_billing_owner', 'ws_billing')).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('rejects a member without billing capability and a cross-tenant workspace', async () => {
    authorizedFixture();
    await expect(getAuthorizedWorkspaceInvoiceHistory('usr_billing_member', 'ws_billing')).rejects.toThrow('WORKSPACE_CAPABILITY_DENIED');
    await expect(getAuthorizedWorkspaceInvoiceHistory('usr_billing_owner', 'ws_other')).rejects.toThrow(/access denied/);
  });

  it('rejects unauthenticated route requests', async () => {
    authorizedFixture();
    const response = await getInvoiceHistory(new Request('https://apiproof.test/api/billing/invoices?workspaceId=ws_billing'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

  it('enforces billing permission and workspace scope through the route', async () => {
    authorizedFixture();
    const memberSession = createSession('usr_billing_member');
    const memberResponse = await getInvoiceHistory(new Request('https://apiproof.test/api/billing/invoices?workspaceId=ws_billing', {
      headers: { cookie: `apiproof_session=${memberSession.id}` },
    }));
    expect(memberResponse.status).toBe(403);
    await expect(memberResponse.json()).resolves.toEqual({ error: 'Billing access denied.', code: 'WORKSPACE_CAPABILITY_DENIED' });

    const ownerSession = createSession('usr_billing_owner');
    const crossWorkspaceResponse = await getInvoiceHistory(new Request('https://apiproof.test/api/billing/invoices?workspaceId=ws_other', {
      headers: { cookie: `apiproof_session=${ownerSession.id}` },
    }));
    expect(crossWorkspaceResponse.status).toBe(404);
    await expect(crossWorkspaceResponse.json()).resolves.toEqual({ error: 'Workspace not found or access denied.', code: 'WORKSPACE_ACCESS_DENIED' });
  });

  it('returns the explicit provider-unavailable state through the authorized route', async () => {
    authorizedFixture();
    const ownerSession = createSession('usr_billing_owner');
    const response = await getInvoiceHistory(new Request('https://apiproof.test/api/billing/invoices?workspaceId=ws_billing', {
      headers: { cookie: `apiproof_session=${ownerSession.id}` },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'unavailable', code: 'PROVIDER_NOT_CONFIGURED' });
  });

  it.todo('returns validated provider invoices after an approved adapter is integrated');
  it.todo('maps provider failures without exposing credentials or internal exceptions');
});
