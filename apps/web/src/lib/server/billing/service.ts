import crypto from 'node:crypto';
import { getDatabase } from '../db/index.js';
import { getPlanDefinition, type PlanDefinition } from './plans.js';
import type { BillingWebhookEvent } from './provider.ts';

export interface WorkspaceSubscription {
  workspaceId: string;
  planId: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceUsageSummary {
  workspaceId: string;
  plan: PlanDefinition;
  subscription: WorkspaceSubscription;
  metrics: {
    repositories: { current: number; limit: number; allowed: boolean };
    scans: { current: number; limit: number; allowed: boolean };
    draftPrs: { current: number; limit: number; allowed: boolean };
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  metric: 'repositories' | 'scans' | 'draft_prs';
  limit: number;
  current: number;
  reason?: string;
}

function getDefaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { start, end };
}

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
  const db = getDatabase();
  let row = await db.queryOne<{
    workspace_id: string;
    plan_id: string;
    customer_id: string | null;
    subscription_id: string | null;
    status: string;
    current_period_start: string;
    current_period_end: string;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT * FROM workspace_subscriptions WHERE workspace_id = ?
  `, [workspaceId]);

  if (!row) {
    const period = getDefaultPeriod();
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO workspace_subscriptions (workspace_id, plan_id, customer_id, subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, 'free', NULL, NULL, 'active', ?, ?, ?, ?)
    `, [workspaceId, period.start, period.end, now, now]);

    row = {
      workspace_id: workspaceId,
      plan_id: 'free',
      customer_id: null,
      subscription_id: null,
      status: 'active',
      current_period_start: period.start,
      current_period_end: period.end,
      created_at: now,
      updated_at: now,
    };
  }

  return {
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    customerId: row.customer_id,
    subscriptionId: row.subscription_id,
    status: row.status as WorkspaceSubscription['status'],
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceUsageSummary(workspaceId: string): Promise<WorkspaceUsageSummary> {
  const db = getDatabase();
  const subscription = await getWorkspaceSubscription(workspaceId);
  const plan = getPlanDefinition(subscription.planId);

  // Repositories count
  const repoRow = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM repositories WHERE workspace_id = ? AND status != 'deleted'
  `, [workspaceId]);
  const repoUsageRow = await db.queryOne<{ total: number }>(`
    SELECT SUM(count) as total FROM workspace_usage WHERE workspace_id = ? AND metric = 'repositories' AND period_start >= ?
  `, [workspaceId, subscription.currentPeriodStart]);
  const repoCount = Math.max(Number(repoRow?.count ?? 0), Number(repoUsageRow?.total ?? 0));

  // Scans count
  const scanRow = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM scans s
    JOIN repositories r ON r.id = s.repository_id
    WHERE r.workspace_id = ? AND s.status = 'completed' AND s.completed_at >= ?
  `, [workspaceId, subscription.currentPeriodStart]);
  const scanUsageRow = await db.queryOne<{ total: number }>(`
    SELECT SUM(count) as total FROM workspace_usage WHERE workspace_id = ? AND metric = 'scans' AND period_start >= ?
  `, [workspaceId, subscription.currentPeriodStart]);
  const scanCount = Math.max(Number(scanRow?.count ?? 0), Number(scanUsageRow?.total ?? 0));

  // Draft PRs count
  const prRow = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM pull_requests pr
    JOIN repositories r ON r.id = pr.repository_id
    WHERE r.workspace_id = ? AND pr.created_at >= ?
  `, [workspaceId, subscription.currentPeriodStart]);
  const prUsageRow = await db.queryOne<{ total: number }>(`
    SELECT SUM(count) as total FROM workspace_usage WHERE workspace_id = ? AND metric = 'draft_prs' AND period_start >= ?
  `, [workspaceId, subscription.currentPeriodStart]);
  const prCount = Math.max(Number(prRow?.count ?? 0), Number(prUsageRow?.total ?? 0));

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  return {
    workspaceId,
    plan,
    subscription,
    metrics: {
      repositories: {
        current: repoCount,
        limit: plan.limits.maxRepositories,
        allowed: isActive && repoCount < plan.limits.maxRepositories,
      },
      scans: {
        current: scanCount,
        limit: plan.limits.maxScansPerMonth,
        allowed: isActive && scanCount < plan.limits.maxScansPerMonth,
      },
      draftPrs: {
        current: prCount,
        limit: plan.limits.maxDraftPrsPerMonth,
        allowed: isActive && prCount < plan.limits.maxDraftPrsPerMonth,
      },
    },
  };
}

export async function checkWorkspaceLimit(
  workspaceId: string,
  metric: 'repositories' | 'scans' | 'draft_prs'
): Promise<LimitCheckResult> {
  const summary = await getWorkspaceUsageSummary(workspaceId);
  const sub = summary.subscription;

  if (sub.status === 'canceled') {
    return {
      allowed: false,
      metric,
      limit: 0,
      current: 0,
      reason: 'SUBSCRIPTION_CANCELED: Workspace subscription is canceled.',
    };
  }

  if (sub.status === 'past_due' || sub.status === 'unpaid') {
    return {
      allowed: false,
      metric,
      limit: 0,
      current: 0,
      reason: 'PAYMENT_PAST_DUE: Payment processing failed for workspace subscription.',
    };
  }

  const metricKey = metric === 'repositories' ? 'repositories' : metric === 'scans' ? 'scans' : 'draftPrs';
  const target = summary.metrics[metricKey];

  if (target.current >= target.limit) {
    return {
      allowed: false,
      metric,
      limit: target.limit,
      current: target.current,
      reason: `PLAN_LIMIT_EXCEEDED: Exceeded ${metric} limit of ${target.limit} for plan '${summary.plan.name}'.`,
    };
  }

  return {
    allowed: true,
    metric,
    limit: target.limit,
    current: target.current,
  };
}

export async function recordWorkspaceUsage(
  workspaceId: string,
  metric: 'repositories' | 'scans' | 'draft_prs',
  _resourceId?: string
): Promise<void> {
  const db = getDatabase();
  const sub = await getWorkspaceSubscription(workspaceId);
  const now = new Date().toISOString();

  // Upsert usage record
  const existing = await db.queryOne<{ id: string; count: number }>(`
    SELECT id, count FROM workspace_usage
    WHERE workspace_id = ? AND metric = ? AND period_start = ?
  `, [workspaceId, metric, sub.currentPeriodStart]);

  if (existing) {
    await db.execute(`
      UPDATE workspace_usage SET count = count + 1, updated_at = ? WHERE id = ?
    `, [now, existing.id]);
  } else {
    const id = `use_${crypto.randomBytes(12).toString('hex')}`;
    await db.execute(`
      INSERT INTO workspace_usage (id, workspace_id, metric, period_start, period_end, count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `, [id, workspaceId, metric, sub.currentPeriodStart, sub.currentPeriodEnd, now, now]);
  }
}

export async function processBillingWebhookEvent(event: BillingWebhookEvent): Promise<{ success: boolean; duplicate: boolean }> {
  const db = getDatabase();
  const payloadHash = crypto.createHash('sha256').update(event.rawPayload).digest('hex');
  const now = new Date().toISOString();

  // Replay check
  const existingEvent = await db.queryOne<{ id: string }>(`
    SELECT id FROM billing_webhook_events WHERE provider = ? AND payload_hash = ?
  `, [event.provider, payloadHash]);

  if (existingEvent) {
    return { success: true, duplicate: true };
  }

  // Record webhook delivery idempotently
  await db.execute(`
    INSERT INTO billing_webhook_events (id, provider, event_type, payload_hash, processed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [event.id, event.provider, event.eventType, payloadHash, now, now]);

  // Update subscription state based on event
  if (event.customerId) {
    const sub = await db.queryOne<{ workspace_id: string }>(`
      SELECT workspace_id FROM workspace_subscriptions WHERE customer_id = ?
    `, [event.customerId]);

    if (sub) {
      let newStatus = event.status || 'active';
      let planId = event.planId;

      if (event.eventType === 'customer.subscription.deleted') {
        newStatus = 'canceled';
        planId = 'free';
      } else if (event.eventType === 'invoice.payment_failed') {
        newStatus = 'past_due';
      }

      await db.execute(`
        UPDATE workspace_subscriptions
        SET status = ?,
            plan_id = COALESCE(?, plan_id),
            subscription_id = COALESCE(?, subscription_id),
            current_period_start = COALESCE(?, current_period_start),
            current_period_end = COALESCE(?, current_period_end),
            updated_at = ?
        WHERE workspace_id = ?
      `, [newStatus, planId || null, event.subscriptionId || null, event.periodStart || null, event.periodEnd || null, now, sub.workspace_id]);
    }
  }

  return { success: true, duplicate: false };
}
