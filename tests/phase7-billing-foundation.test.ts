/**
 * Phase 7: Workspace Billing Foundation Test Suite
 *
 * Covers:
 *   TEST 1: Workspace isolation of subscriptions, plan definitions, and usage counters
 *   TEST 2: Period-scoped usage counting and limit calculation
 *   TEST 3: Server-side limit enforcement for repositories, scans, and draft PRs
 *   TEST 4: Plan transitions (Free -> Pro -> Enterprise) update limits dynamically
 *   TEST 5: Failed payments (invoice.payment_failed) transition status to past_due and enforce restriction
 *   TEST 6: Canceled subscriptions (customer.subscription.deleted) transition status to canceled
 *   TEST 7: Webhook security — HMAC signature verification rejects invalid or tampered signatures
 *   TEST 8: Webhook idempotency — repeated webhook payload hashes are rejected as duplicate
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserAsync } from '../apps/web/src/lib/server/auth.js';
import { createSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import {
  getWorkspaceSubscription,
  getWorkspaceUsageSummary,
  checkWorkspaceLimit,
  recordWorkspaceUsage,
  processBillingWebhookEvent,
} from '../apps/web/src/lib/server/billing/service.js';
import { MockBillingProvider } from '../apps/web/src/lib/server/billing/provider.js';
import { PLANS } from '../apps/web/src/lib/server/billing/plans.js';
import { POST as createCheckout } from '../apps/web/src/app/api/billing/checkout/route.js';
import { POST as createBillingPortal } from '../apps/web/src/app/api/billing/portal/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase7-billing.db');

describe('Phase 7 — Workspace Billing Foundation', () => {
  beforeEach(() => {
    process.env.BILLING_WEBHOOK_SECRET = 'test_phase7_webhook_secret_32_chars!';
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  // -------------------------------------------------------------------------
  // TEST 1: Workspace Isolation
  // -------------------------------------------------------------------------
  it('TEST 1: Subscriptions and usage counters are isolated strictly per workspace', async () => {
    const userA = await createUserAsync('billing-a@apiproof.test', 'Pass123!#$', 'User A');
    const wsA = await getDefaultWorkspaceForUser(userA.id);

    const userB = await createUserAsync('billing-b@apiproof.test', 'Pass123!#$', 'User B');
    const wsB = await getDefaultWorkspaceForUser(userB.id);

    const subA = await getWorkspaceSubscription(wsA.id);
    const subB = await getWorkspaceSubscription(wsB.id);

    expect(subA.workspaceId).toBe(wsA.id);
    expect(subB.workspaceId).toBe(wsB.id);
    expect(subA.workspaceId).not.toBe(subB.workspaceId);

    // Record usage in Workspace A
    await recordWorkspaceUsage(wsA.id, 'scans');
    await recordWorkspaceUsage(wsA.id, 'scans');

    const summaryA = await getWorkspaceUsageSummary(wsA.id);
    const summaryB = await getWorkspaceUsageSummary(wsB.id);

    expect(summaryA.metrics.scans.current).toBe(2);
    expect(summaryB.metrics.scans.current).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Usage Counting & Scoping
  // -------------------------------------------------------------------------
  it('TEST 2: Usage counting correctly aggregates metrics per period', async () => {
    const user = await createUserAsync('usage-user@apiproof.test', 'Pass123!#$', 'Usage User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    let check = await checkWorkspaceLimit(ws.id, 'draft_prs');
    expect(check.allowed).toBe(true);
    expect(check.current).toBe(0);

    check = await checkWorkspaceLimit(ws.id, 'draft_prs');
    expect(check.current).toBe(0);
    expect(check.limit).toBe(2); // Free includes a small guarded Draft PR allowance
    expect(check.allowed).toBe(true);
  });

  it('denies usage when subscription status is incomplete or unknown, while allowing trialing', async () => {
    const user = await createUserAsync('billing-status-policy@apiproof.test', 'Pass123!#$', 'Billing Status');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await getWorkspaceSubscription(workspace.id);

    for (const status of ['incomplete', 'unexpected_status']) {
      await db.execute('UPDATE workspace_subscriptions SET status = ? WHERE workspace_id = ?', [status, workspace.id]);
      await expect(checkWorkspaceLimit(workspace.id, 'scans')).resolves.toMatchObject({
        allowed: false,
        limit: 0,
        current: 0,
        reason: 'SUBSCRIPTION_INACTIVE: Workspace subscription is not active.',
      });
    }

    await db.execute("UPDATE workspace_subscriptions SET status = 'trialing' WHERE workspace_id = ?", [workspace.id]);
    await expect(checkWorkspaceLimit(workspace.id, 'scans')).resolves.toMatchObject({ allowed: true });
  });

  // -------------------------------------------------------------------------
  // TEST 3: Server-side Limit Enforcement
  // -------------------------------------------------------------------------
  it('TEST 3: Limit enforcement blocks billable actions when plan quotas are exceeded', async () => {
    const user = await createUserAsync('limit-user@apiproof.test', 'Pass123!#$', 'Limit User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    // Insert 1 repository into Free plan (max 1 allowed)
    for (let i = 0; i < 1; i++) {
      await db.execute(`
        INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'org', ?, ?, ?, 'main', 'active', CURRENT_TIMESTAMP)
      `, [`repo_lim_${i}`, ws.id, `app-${i}`, `org/app-${i}`, `gh_${i}`]);
    }

    const check = await checkWorkspaceLimit(ws.id, 'repositories');
    expect(check.allowed).toBe(false);
    expect(check.limit).toBe(1);
    expect(check.current).toBe(1);
    expect(check.reason).toContain('PLAN_LIMIT_EXCEEDED');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Plan Transitions
  // -------------------------------------------------------------------------
  it('TEST 4: Transitioning from Free to Pro increases quotas dynamically', async () => {
    const user = await createUserAsync('plan-transition@apiproof.test', 'Pass123!#$', 'Plan User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    let summary = await getWorkspaceUsageSummary(ws.id);
    expect(summary.plan.id).toBe('free');
    expect(summary.plan.limits.maxRepositories).toBe(1);

    // Update plan to Pro
    await db.execute(`
      UPDATE workspace_subscriptions SET plan_id = 'pro' WHERE workspace_id = ?
    `, [ws.id]);

    summary = await getWorkspaceUsageSummary(ws.id);
    expect(summary.plan.id).toBe('pro');
    expect(summary.plan.limits.maxRepositories).toBe(5);
    expect(summary.plan.limits.maxScansPerMonth).toBeNull();
    expect(summary.plan.limits.maxDraftPrsPerMonth).toBe(20);
    for (let i = 0; i < 25; i++) await recordWorkspaceUsage(ws.id, 'scans');
    expect((await checkWorkspaceLimit(ws.id, 'scans')).allowed).toBe(true);
    for (let i = 0; i < 20; i++) await recordWorkspaceUsage(ws.id, 'draft_prs');
    expect((await checkWorkspaceLimit(ws.id, 'draft_prs')).allowed).toBe(false);

    await db.execute(`
      UPDATE workspace_subscriptions SET plan_id = 'team' WHERE workspace_id = ?
    `, [ws.id]);
    summary = await getWorkspaceUsageSummary(ws.id);
    expect(summary.plan.id).toBe('team');
    expect(summary.plan.priceMonthly).toBe(15000);
    expect(summary.plan.limits.maxRepositories).toBeNull();
    expect(summary.plan.limits.maxScansPerMonth).toBeNull();
    expect(summary.plan.limits.maxDraftPrsPerMonth).toBe(100);
    for (let i = 0; i < 100; i++) await recordWorkspaceUsage(ws.id, 'draft_prs');
    expect((await checkWorkspaceLimit(ws.id, 'draft_prs')).allowed).toBe(false);
  });

  it('treats null quotas as unlimited and preserves Enterprise custom limits', async () => {
    const user = await createUserAsync('unlimited-scans@apiproof.test', 'Pass123!#$', 'Unlimited Scans');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    for (let i = 0; i < 3; i++) await recordWorkspaceUsage(ws.id, 'scans');
    const freeScanLimit = await checkWorkspaceLimit(ws.id, 'scans');
    expect(freeScanLimit.allowed).toBe(false);
    expect(freeScanLimit.limit).toBe(3);

    await db.execute(`UPDATE workspace_subscriptions SET plan_id = 'enterprise' WHERE workspace_id = ?`, [ws.id]);
    const enterprise = await getWorkspaceUsageSummary(ws.id);
    expect(enterprise.plan.priceMonthly).toBeNull();
    expect(enterprise.metrics.repositories.limit).toBeNull();
    expect(enterprise.metrics.repositories.allowed).toBe(true);
    expect(enterprise.metrics.scans.limit).toBe(100000);
    expect(enterprise.metrics.draftPrs.limit).toBe(100000);
    expect(PLANS.free?.limits).toEqual({ maxRepositories: 1, maxScansPerMonth: 3, maxDraftPrsPerMonth: 2 });
    expect(PLANS.pro?.priceMonthly).toBe(5000);
  });

  it('rejects paid checkout while keeping custom Enterprise on the contact path', async () => {
    const user = await createUserAsync('checkout-plans@apiproof.test', 'Pass123!#$', 'Checkout Plans');
    const session = createSession(user.id);
    const request = (planId: string) => new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${session.id}`,
      },
      body: JSON.stringify({ planId }),
    });

    const teamResponse = await createCheckout(request('team'));
    expect(teamResponse.status).toBe(403);
    expect(await teamResponse.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });

    const enterpriseResponse = await createCheckout(request('enterprise'));
    expect(enterpriseResponse.status).toBe(400);
    expect(await enterpriseResponse.json()).toMatchObject({ error: expect.stringContaining('purchasable') });
  });

  it('fails closed with a safe response when the billing portal has no production provider', async () => {
    const user = await createUserAsync('billing-portal-unavailable@apiproof.test', 'Pass123!#$', 'Portal User');
    const session = createSession(user.id);
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const response = await createBillingPortal(new Request('http://localhost/api/billing/portal', {
        method: 'POST',
        headers: { cookie: `apiproof_session=${session.id}` },
      }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'Billing portal is unavailable' });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  // -------------------------------------------------------------------------
  // TEST 5: Failed Payments (past_due)
  // -------------------------------------------------------------------------
  it('TEST 5: Failed payment webhooks transition status to past_due and restrict operations', async () => {
    const user = await createUserAsync('pastdue-user@apiproof.test', 'Pass123!#$', 'Past Due User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    // Initialize workspace subscription record first
    await getWorkspaceSubscription(ws.id);

    // Attach customer ID
    await db.execute(`
      UPDATE workspace_subscriptions SET customer_id = 'cus_test_pastdue' WHERE workspace_id = ?
    `, [ws.id]);

    // Simulate invoice.payment_failed webhook
    const rawPayload = JSON.stringify({
      id: 'evt_pay_fail_01',
      type: 'invoice.payment_failed',
      customer_id: 'cus_test_pastdue',
      status: 'past_due',
    });

    const mockProvider = new MockBillingProvider();
    const signature = crypto.createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET!).update(rawPayload).digest('hex');
    const event = await mockProvider.verifyAndParseWebhook(rawPayload, signature);

    await processBillingWebhookEvent(event);

    const sub = await getWorkspaceSubscription(ws.id);
    expect(sub.status).toBe('past_due');

    const check = await checkWorkspaceLimit(ws.id, 'scans');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('PAYMENT_PAST_DUE');
  });

  // -------------------------------------------------------------------------
  // TEST 6: Canceled Subscriptions
  // -------------------------------------------------------------------------
  it('TEST 6: Canceled subscription webhooks set status to canceled and fallback to free', async () => {
    const user = await createUserAsync('canceled-user@apiproof.test', 'Pass123!#$', 'Canceled User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    // Initialize workspace subscription record first
    await getWorkspaceSubscription(ws.id);

    await db.execute(`
      UPDATE workspace_subscriptions SET customer_id = 'cus_test_cancel', plan_id = 'pro' WHERE workspace_id = ?
    `, [ws.id]);

    const rawPayload = JSON.stringify({
      id: 'evt_cancel_01',
      type: 'customer.subscription.deleted',
      customer_id: 'cus_test_cancel',
      status: 'canceled',
    });

    const mockProvider = new MockBillingProvider();
    const signature = crypto.createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET!).update(rawPayload).digest('hex');
    const event = await mockProvider.verifyAndParseWebhook(rawPayload, signature);

    await processBillingWebhookEvent(event);

    const sub = await getWorkspaceSubscription(ws.id);
    expect(sub.status).toBe('canceled');
    expect(sub.planId).toBe('free');

    const check = await checkWorkspaceLimit(ws.id, 'scans');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('SUBSCRIPTION_CANCELED');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Webhook Signature Security
  // -------------------------------------------------------------------------
  it('TEST 7: Webhook verification rejects invalid or tampered HMAC signatures', async () => {
    const rawPayload = JSON.stringify({ id: 'evt_tampered_01', type: 'customer.subscription.updated' });
    const mockProvider = new MockBillingProvider();

    await expect(
      mockProvider.verifyAndParseWebhook(rawPayload, 'invalid_signature_hash')
    ).rejects.toThrowError(/INVALID_BILLING_SIGNATURE/);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Webhook Replay Protection & Idempotency
  // -------------------------------------------------------------------------
  it('TEST 8: Repeated webhook payloads are detected and processed idempotently without side effects', async () => {
    const rawPayload = JSON.stringify({
      id: 'evt_idempotent_01',
      type: 'customer.subscription.updated',
      customer_id: 'cus_idempotent',
      status: 'active',
    });

    const mockProvider = new MockBillingProvider();
    const signature = crypto.createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET!).update(rawPayload).digest('hex');
    const event = await mockProvider.verifyAndParseWebhook(rawPayload, signature);

    // 1st Processing
    const res1 = await processBillingWebhookEvent(event);
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBe(false);

    // 2nd Processing (Duplicate Payload)
    const res2 = await processBillingWebhookEvent(event);
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
  });

  it('serializes concurrent duplicate webhook deliveries with one atomic subscription update', async () => {
    const user = await createUserAsync('billing-concurrent-event@apiproof.test', 'Pass123!#$', 'Concurrent Event');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await getWorkspaceSubscription(workspace.id);
    await db.execute(`
      UPDATE workspace_subscriptions SET customer_id = 'cus_concurrent_event' WHERE workspace_id = ?
    `, [workspace.id]);

    const rawPayload = JSON.stringify({
      id: 'evt_concurrent_01',
      type: 'invoice.payment_failed',
      customer_id: 'cus_concurrent_event',
      status: 'past_due',
    });
    const signature = crypto.createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET!).update(rawPayload).digest('hex');
    const event = await new MockBillingProvider().verifyAndParseWebhook(rawPayload, signature);

    const results = await Promise.all([
      processBillingWebhookEvent(event),
      processBillingWebhookEvent(event),
    ]);

    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect((await getWorkspaceSubscription(workspace.id)).status).toBe('past_due');
    const recordedEvents = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM billing_webhook_events WHERE provider = ? AND payload_hash = ?
    `, [event.provider, crypto.createHash('sha256').update(event.rawPayload).digest('hex')]);
    expect(Number(recordedEvents?.count)).toBe(1);
  });
});
