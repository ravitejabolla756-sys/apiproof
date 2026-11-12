import crypto from 'node:crypto';

export interface BillingWebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  customerId?: string;
  subscriptionId?: string;
  status?: string;
  planId?: string;
  periodStart?: string;
  periodEnd?: string;
  rawPayload: string;
}

export type BillingSubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'unpaid';

export interface BillingSubscriptionSnapshot {
  status: BillingSubscriptionStatus;
  planId: string;
  currentPeriodEnd: string;
}

export type BillingLifecycleDecision =
  | { action: 'apply'; status: BillingSubscriptionStatus; planId?: string; subscriptionId?: string; periodStart?: string; periodEnd?: string }
  | { action: 'ignore'; reason: 'UNSUPPORTED_BILLING_EVENT' | 'REFUND_POLICY_PENDING' | 'GRACE_POLICY_PENDING' | 'OUT_OF_ORDER_PERIOD' | 'INVALID_BILLING_STATUS' };

const BILLING_STATUSES = new Set<BillingSubscriptionStatus>(['active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid']);

/**
 * Provider-neutral lifecycle mapping. Only event meanings already documented
 * by the integration contract are applied; provider-specific refund/grace and
 * ordering semantics remain explicitly unavailable until approved.
 */
export function reconcileBillingEvent(
  event: BillingWebhookEvent,
  current?: BillingSubscriptionSnapshot,
): BillingLifecycleDecision {
  if (event.eventType === 'charge.refunded' || event.eventType === 'invoice.refunded') return { action: 'ignore', reason: 'REFUND_POLICY_PENDING' };
  if (event.eventType === 'customer.subscription.paused' || event.eventType === 'invoice.payment_action_required') return { action: 'ignore', reason: 'GRACE_POLICY_PENDING' };

  let status: BillingSubscriptionStatus | undefined;
  let planId = event.planId;
  if (event.eventType === 'customer.subscription.deleted') {
    status = 'canceled';
    planId = 'free';
  } else if (event.eventType === 'invoice.payment_failed') {
    status = 'past_due';
  } else if (event.eventType === 'invoice.payment_succeeded') {
    status = 'active';
  } else if (event.eventType === 'customer.subscription.created' || event.eventType === 'customer.subscription.updated') {
    if (!event.status || !BILLING_STATUSES.has(event.status as BillingSubscriptionStatus)) return { action: 'ignore', reason: 'INVALID_BILLING_STATUS' };
    status = event.status as BillingSubscriptionStatus;
  } else {
    return { action: 'ignore', reason: 'UNSUPPORTED_BILLING_EVENT' };
  }

  if (current && event.periodEnd && Date.parse(event.periodEnd) < Date.parse(current.currentPeriodEnd) && event.eventType !== 'customer.subscription.deleted') {
    return { action: 'ignore', reason: 'OUT_OF_ORDER_PERIOD' };
  }
  return { action: 'apply', status, ...(planId ? { planId } : {}), ...(event.subscriptionId ? { subscriptionId: event.subscriptionId } : {}), ...(event.periodStart ? { periodStart: event.periodStart } : {}), ...(event.periodEnd ? { periodEnd: event.periodEnd } : {}) };
}

export interface BillingProvider {
  name: string;
  createCustomer(workspaceId: string, email: string, name: string): Promise<{ customerId: string }>;
  createCheckoutSession(workspaceId: string, customerId: string, planId: string, returnUrl: string): Promise<{ checkoutUrl: string }>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ portalUrl: string }>;
  verifyAndParseWebhook(rawBody: string, signature: string): Promise<BillingWebhookEvent>;
}

export class MockBillingProvider implements BillingProvider {
  name = 'mock';

  async createCustomer(workspaceId: string, _email: string, _name: string): Promise<{ customerId: string }> {
    return { customerId: `cus_mock_${workspaceId.slice(0, 8)}` };
  }

  async createCheckoutSession(workspaceId: string, customerId: string, planId: string, returnUrl: string): Promise<{ checkoutUrl: string }> {
    const sessionToken = crypto.randomBytes(16).toString('hex');
    return {
      checkoutUrl: `${returnUrl}?billing_status=checkout_simulated&ws=${workspaceId}&plan=${planId}&cus=${customerId}&session=${sessionToken}`,
    };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ portalUrl: string }> {
    return {
      portalUrl: `${returnUrl}?billing_status=portal_simulated&cus=${customerId}`,
    };
  }

  async verifyAndParseWebhook(rawBody: string, signature: string): Promise<BillingWebhookEvent> {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret) throw new Error('BILLING_WEBHOOK_UNAVAILABLE: Provider signing secret is not configured.');
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!signature || signature.length !== hmac.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) {
      throw new Error('INVALID_BILLING_SIGNATURE: Webhook HMAC verification failed');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error('MALFORMED_BILLING_EVENT');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('MALFORMED_BILLING_EVENT');
    const record = payload as Record<string, unknown>;
    const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? record.data as Record<string, unknown>
      : undefined;
    const object = data?.object && typeof data.object === 'object' && !Array.isArray(data.object)
      ? data.object as Record<string, unknown>
      : undefined;
    const items = object?.items && typeof object.items === 'object' && !Array.isArray(object.items)
      ? object.items as Record<string, unknown>
      : undefined;
    const itemData = Array.isArray(items?.data) ? items.data[0] : undefined;
    const firstPrice = itemData && typeof itemData === 'object' && !Array.isArray(itemData)
      && itemData.price && typeof itemData.price === 'object' && !Array.isArray(itemData.price)
      ? itemData.price as Record<string, unknown>
      : undefined;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const eventType = typeof record.type === 'string' ? record.type.trim() : typeof record.event_type === 'string' ? record.event_type.trim() : '';
    if (!id || !eventType) throw new Error('MALFORMED_BILLING_EVENT');
    const event: BillingWebhookEvent = {
      id,
      provider: 'mock',
      eventType,
      rawPayload: rawBody,
    };
    const customerId = typeof object?.customer === 'string' ? object.customer : typeof record.customer_id === 'string' ? record.customer_id : undefined;
    const subscriptionId = typeof object?.id === 'string' ? object.id : typeof record.subscription_id === 'string' ? record.subscription_id : undefined;
    const status = typeof object?.status === 'string' ? object.status : typeof record.status === 'string' ? record.status : undefined;
    const planId = typeof firstPrice?.nickname === 'string' ? firstPrice.nickname : typeof record.plan_id === 'string' ? record.plan_id : undefined;
    const periodStart = typeof object?.current_period_start === 'number' ? new Date(object.current_period_start * 1000).toISOString() : typeof record.period_start === 'string' ? record.period_start : undefined;
    const periodEnd = typeof object?.current_period_end === 'number' ? new Date(object.current_period_end * 1000).toISOString() : typeof record.period_end === 'string' ? record.period_end : undefined;
    if (customerId) event.customerId = customerId;
    if (subscriptionId) event.subscriptionId = subscriptionId;
    if (status) event.status = status;
    if (planId) event.planId = planId;
    if (periodStart) event.periodStart = periodStart;
    if (periodEnd) event.periodEnd = periodEnd;
    return event;
  }
}

export function getBillingProvider(): BillingProvider {
  return new MockBillingProvider();
}
