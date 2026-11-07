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

export interface BillingProvider {
  name: string;
  createCustomer(workspaceId: string, email: string, name: string): Promise<{ customerId: string }>;
  createCheckoutSession(workspaceId: string, customerId: string, planId: string, returnUrl: string): Promise<{ checkoutUrl: string }>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ portalUrl: string }>;
  verifyAndParseWebhook(rawBody: string, signature: string): Promise<BillingWebhookEvent>;
}

export class BillingProviderUnavailableError extends Error {
  readonly code = 'BILLING_PROVIDER_UNAVAILABLE';

  constructor() {
    super('Billing provider is not configured for this environment.');
    this.name = 'BillingProviderUnavailableError';
  }
}

export class BillingWebhookInputError extends Error {
  readonly code = 'INVALID_BILLING_WEBHOOK';

  constructor() {
    super('Billing webhook input is invalid.');
    this.name = 'BillingWebhookInputError';
  }
}

export class BillingWebhookSignatureError extends Error {
  readonly code = 'INVALID_BILLING_SIGNATURE';

  constructor() {
    super('INVALID_BILLING_SIGNATURE');
    this.name = 'BillingWebhookSignatureError';
  }
}

const SUBSCRIPTION_STATUSES = new Set(['active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid']);
const BILLING_PLAN_IDS = new Set(['free', 'pro', 'team', 'enterprise']);

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
    if (process.env.NODE_ENV === 'production') throw new BillingProviderUnavailableError();

    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) throw new BillingProviderUnavailableError();
    if (Buffer.byteLength(rawBody, 'utf8') > 256 * 1024) throw new BillingWebhookInputError();

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
    const supplied = /^[a-f\d]{64}$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);

    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      throw new BillingWebhookSignatureError();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BillingWebhookInputError();
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BillingWebhookInputError();
    const body = payload as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const eventType = typeof body.type === 'string' ? body.type.trim()
      : typeof body.event_type === 'string' ? body.event_type.trim() : '';
    if (!id || id.length > 255 || !eventType || eventType.length > 255) throw new BillingWebhookInputError();

    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data as Record<string, unknown> : {};
    const object = data.object && typeof data.object === 'object' && !Array.isArray(data.object)
      ? data.object as Record<string, unknown> : {};
    const customer = typeof object.customer === 'string' ? object.customer : body.customer_id;
    const subscription = typeof object.id === 'string' ? object.id : body.subscription_id;
    const status = typeof object.status === 'string' ? object.status : body.status;
    const items = object.items && typeof object.items === 'object' && !Array.isArray(object.items)
      ? object.items as Record<string, unknown> : {};
    const itemData = Array.isArray(items.data) ? items.data[0] : undefined;
    const price = itemData && typeof itemData === 'object' && !Array.isArray(itemData)
      ? (itemData as Record<string, unknown>).price : undefined;
    const plan = price && typeof price === 'object' && !Array.isArray(price)
      ? (price as Record<string, unknown>).nickname : body.plan_id;
    if (typeof status === 'string' && !SUBSCRIPTION_STATUSES.has(status)) throw new BillingWebhookInputError();
    if (typeof plan === 'string' && !BILLING_PLAN_IDS.has(plan)) throw new BillingWebhookInputError();

    const normalizePeriod = (value: unknown): string | undefined => {
      if (value === undefined || value === null) return undefined;
      const milliseconds = typeof value === 'number' && Number.isFinite(value) ? value * 1000
        : typeof value === 'string' ? Date.parse(value) : Number.NaN;
      const date = new Date(milliseconds);
      if (!Number.isFinite(date.getTime())) throw new BillingWebhookInputError();
      return date.toISOString();
    };
    const periodStart = normalizePeriod(object.current_period_start ?? body.period_start);
    const periodEnd = normalizePeriod(object.current_period_end ?? body.period_end);

    return {
      id,
      provider: 'mock',
      eventType,
      ...(typeof customer === 'string' ? { customerId: customer } : {}),
      ...(typeof subscription === 'string' ? { subscriptionId: subscription } : {}),
      ...(typeof status === 'string' ? { status } : {}),
      ...(typeof plan === 'string' ? { planId: plan } : {}),
      ...(typeof periodStart === 'string' ? { periodStart } : {}),
      ...(typeof periodEnd === 'string' ? { periodEnd } : {}),
      rawPayload: rawBody,
    };
  }
}

export function getBillingProvider(): BillingProvider {
  if (process.env.NODE_ENV === 'production') throw new BillingProviderUnavailableError();
  return new MockBillingProvider();
}
