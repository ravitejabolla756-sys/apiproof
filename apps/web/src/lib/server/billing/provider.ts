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

export interface BillingWebhookHeaders {
  'webhook-id': string;
  'webhook-signature': string;
  'webhook-timestamp': string;
}

export type BillingSubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'unpaid';

export interface BillingSubscriptionSnapshot {
  status: BillingSubscriptionStatus;
  planId: string;
  currentPeriodEnd: string;
}

export type BillingLifecycleDecision =
  | { action: 'apply'; status: BillingSubscriptionStatus; planId?: string; subscriptionId?: string; periodStart?: string; periodEnd?: string }
  | { action: 'ignore'; reason: 'UNSUPPORTED_BILLING_EVENT' | 'REFUND_POLICY_PENDING' | 'GRACE_POLICY_PENDING' | 'OUT_OF_ORDER_PERIOD' | 'INVALID_BILLING_STATUS' | 'INVALID_BILLING_PERIOD' | 'INVALID_BILLING_PLAN' };

const BILLING_STATUSES = new Set<BillingSubscriptionStatus>(['active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid']);
const BILLING_PLAN_IDS = new Set(['free', 'pro', 'team', 'enterprise']);

function validBillingDate(value: string | undefined): boolean {
  return value === undefined || (Number.isFinite(Date.parse(value)) && value.trim().length <= 128);
}

/**
 * Provider-neutral lifecycle mapping. Only event meanings already documented
 * by the integration contract are applied; provider-specific refund/grace and
 * ordering semantics remain explicitly unavailable until approved.
 */
export function reconcileBillingEvent(
  event: BillingWebhookEvent,
  current?: BillingSubscriptionSnapshot,
): BillingLifecycleDecision {
  if (!validBillingDate(event.periodStart) || !validBillingDate(event.periodEnd)
    || (current !== undefined && !validBillingDate(current.currentPeriodEnd))) {
    return { action: 'ignore', reason: 'INVALID_BILLING_PERIOD' };
  }
  if (event.periodStart && event.periodEnd && Date.parse(event.periodStart) > Date.parse(event.periodEnd)) {
    return { action: 'ignore', reason: 'INVALID_BILLING_PERIOD' };
  }
  if (event.planId !== undefined && !BILLING_PLAN_IDS.has(event.planId)) {
    return { action: 'ignore', reason: 'INVALID_BILLING_PLAN' };
  }
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
  verifyAndParseWebhook(rawBody: string, signature: string | BillingWebhookHeaders): Promise<BillingWebhookEvent>;
}

export class BillingProviderUnavailableError extends Error {
  readonly code = 'BILLING_PROVIDER_UNAVAILABLE';

  constructor() {
    super('Billing is unavailable until an approved provider adapter is configured.');
    this.name = 'BillingProviderUnavailableError';
  }
}

/** Production-safe fallback. It never simulates checkout, portal, or webhook behavior. */
export class UnavailableBillingProvider implements BillingProvider {
  name = 'unavailable';

  async createCustomer(): Promise<{ customerId: string }> {
    throw new BillingProviderUnavailableError();
  }

  async createCheckoutSession(): Promise<{ checkoutUrl: string }> {
    throw new BillingProviderUnavailableError();
  }

  async createPortalSession(): Promise<{ portalUrl: string }> {
    throw new BillingProviderUnavailableError();
  }

  async verifyAndParseWebhook(): Promise<BillingWebhookEvent> {
    throw new BillingProviderUnavailableError();
  }
}

type DodoEnvironment = 'test_mode' | 'live_mode';
type DodoFetch = typeof fetch;

function dodoWebhookKey(secret: string): Buffer {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(encoded, 'base64');
}

function verifyDodoWebhook(rawBody: string, headers: BillingWebhookHeaders, secret: string): void {
  if (!headers['webhook-id'] || !headers['webhook-signature'] || !headers['webhook-timestamp']) {
    throw new Error('INVALID_BILLING_SIGNATURE: Required Dodo webhook headers are missing');
  }
  const timestamp = Number(headers['webhook-timestamp']);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) {
    throw new Error('INVALID_BILLING_SIGNATURE: Dodo webhook timestamp is outside the allowed window');
  }
  const expected = crypto.createHmac('sha256', dodoWebhookKey(secret))
    .update(`${headers['webhook-id']}.${headers['webhook-timestamp']}.${rawBody}`)
    .digest('base64');
  const matches = headers['webhook-signature'].split(' ').some((candidate) => {
    const [version, signature] = candidate.split(',', 2);
    if (version !== 'v1' || !signature || signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
  if (!matches) throw new Error('INVALID_BILLING_SIGNATURE: Dodo webhook signature verification failed');
}

function dodoPayloadRecord(payload: unknown): { id: string; eventType: string; data: Record<string, unknown> } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('MALFORMED_BILLING_EVENT');
  const record = payload as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const eventType = typeof record.type === 'string' ? record.type.trim() : '';
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : {};
  if (!id || !eventType) throw new Error('MALFORMED_BILLING_EVENT');
  return { id, eventType, data };
}

function mapDodoEventType(eventType: string): { eventType: string; status?: BillingSubscriptionStatus } {
  switch (eventType) {
    case 'payment.succeeded':
    case 'subscription.renewed':
      return { eventType: 'invoice.payment_succeeded', status: 'active' };
    case 'payment.failed':
      return { eventType: 'invoice.payment_failed', status: 'past_due' };
    case 'subscription.active':
      return { eventType: 'customer.subscription.updated', status: 'active' };
    case 'subscription.past_due':
      return { eventType: 'customer.subscription.updated', status: 'past_due' };
    case 'subscription.on_hold':
      return { eventType: 'customer.subscription.updated', status: 'unpaid' };
    case 'subscription.cancelled':
    case 'subscription.expired':
      return { eventType: 'customer.subscription.deleted', status: 'canceled' };
    case 'refund.succeeded':
      return { eventType: 'invoice.refunded' };
    default:
      return { eventType };
  }
}

/**
 * Dodo's hosted checkout adapter is deliberately test-mode-only until the
 * owner approves the live provider contract. Product IDs are server-owned;
 * callers provide only the public MY OWL plan slug.
 */
export class DodoBillingProvider implements BillingProvider {
  readonly name = 'dodo';
  private readonly apiKey: string;
  private readonly environment: DodoEnvironment;
  private readonly products: Record<'pro' | 'team', string>;
  private readonly fetchImpl: DodoFetch;

  constructor(environment: NodeJS.ProcessEnv = process.env, fetchImpl: DodoFetch = fetch) {
    this.apiKey = environment.DODO_PAYMENTS_API_KEY?.trim() ?? '';
    this.environment = environment.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode';
    this.products = {
      pro: environment.DODO_PRODUCT_PRO_ID?.trim() ?? '',
      team: environment.DODO_PRODUCT_TEAM_ID?.trim() ?? '',
    };
    this.fetchImpl = fetchImpl;
    if (!this.apiKey || !this.products.pro || !this.products.team) {
      throw new BillingProviderUnavailableError();
    }
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`https://${this.environment === 'test_mode' ? 'test' : 'live'}.dodopayments.com${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('BILLING_PROVIDER_UNAVAILABLE: Dodo request failed');
    return await response.json() as T;
  }

  async createCustomer(_workspaceId: string, email: string, name: string): Promise<{ customerId: string }> {
    const response = await this.request<{ customer_id?: string }>('/customers', { email, name });
    if (!response.customer_id) throw new Error('BILLING_PROVIDER_UNAVAILABLE: Dodo customer response was incomplete');
    return { customerId: response.customer_id };
  }

  async createCheckoutSession(workspaceId: string, customerId: string, planId: string, returnUrl: string): Promise<{ checkoutUrl: string }> {
    const productId = planId === 'pro' ? this.products.pro : planId === 'team' ? this.products.team : '';
    if (!productId) throw new Error('INVALID_PLAN');
    const response = await this.request<{ checkout_url?: string }>('/checkouts', {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { customer_id: customerId },
      return_url: returnUrl,
      metadata: { workspace_id: workspaceId, plan_id: planId },
    });
    if (!response.checkout_url) throw new Error('BILLING_PROVIDER_UNAVAILABLE: Dodo checkout response was incomplete');
    return { checkoutUrl: response.checkout_url };
  }

  async createPortalSession(): Promise<{ portalUrl: string }> {
    throw new Error('BILLING_PROVIDER_UNAVAILABLE: Dodo portal contract is not enabled');
  }

  async verifyAndParseWebhook(rawBody: string, headers: string | BillingWebhookHeaders): Promise<BillingWebhookEvent> {
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
    if (!secret) throw new Error('BILLING_WEBHOOK_UNAVAILABLE: Dodo webhook key is not configured');
    if (typeof headers === 'string') throw new Error('INVALID_BILLING_SIGNATURE: Dodo requires Standard Webhooks headers');
    verifyDodoWebhook(rawBody, headers, secret);
    let parsed: unknown;
    try { parsed = JSON.parse(rawBody); } catch { throw new Error('MALFORMED_BILLING_EVENT'); }
    const { id, eventType: dodoEventType, data } = dodoPayloadRecord(parsed);
    const mapped = mapDodoEventType(dodoEventType);
    const customer = data.customer && typeof data.customer === 'object' && !Array.isArray(data.customer)
      ? data.customer as Record<string, unknown>
      : undefined;
    const customerId = typeof customer?.customer_id === 'string' ? customer.customer_id : typeof data.customer_id === 'string' ? data.customer_id : undefined;
    const subscriptionId = typeof data.subscription_id === 'string' ? data.subscription_id : undefined;
    const status = typeof data.status === 'string' ? data.status : undefined;
    const periodEnd = typeof data.next_billing_date === 'string' ? data.next_billing_date : undefined;
    const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? data.metadata as Record<string, unknown>
      : undefined;
    const productId = typeof data.product_id === 'string' ? data.product_id : undefined;
    const planId = typeof metadata?.plan_id === 'string'
      ? metadata.plan_id
      : productId === this.products.pro ? 'pro' : productId === this.products.team ? 'team' : undefined;
    const normalizedStatus = mapped.status ?? status;
    return {
      id,
      provider: 'dodo',
      eventType: mapped.eventType,
      ...(customerId ? { customerId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(planId ? { planId } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      rawPayload: rawBody,
    };
  }
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

  async verifyAndParseWebhook(rawBody: string, signature: string | BillingWebhookHeaders): Promise<BillingWebhookEvent> {
    if (typeof signature !== 'string') throw new Error('INVALID_BILLING_SIGNATURE: Mock provider expects a legacy signature');
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

export function getBillingProvider(environment: NodeJS.ProcessEnv = process.env): BillingProvider {
  if (environment.NODE_ENV !== 'production' && environment.BILLING_PROVIDER === 'mock') return new MockBillingProvider();
  if (environment.NODE_ENV !== 'production'
    && environment.BILLING_PROVIDER === 'dodo'
    && environment.DODO_PAYMENTS_ENVIRONMENT === 'test_mode'
    && environment.DODO_ENABLE_TEST_CHECKOUT === 'true') {
    try { return new DodoBillingProvider(environment); } catch { return new UnavailableBillingProvider(); }
  }
  return new UnavailableBillingProvider();
}
