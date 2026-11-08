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
export const MAX_BILLING_WEBHOOK_BYTES = 256 * 1024;

/** Validate provider-neutral event data before any durable billing projection. */
export function assertNormalizedBillingWebhookEvent(value: unknown): asserts value is BillingWebhookEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BillingWebhookInputError();
  const event = value as Record<string, unknown>;
  const isBoundedText = (item: unknown, maxLength: number): item is string =>
    typeof item === 'string'
    && item.length > 0
    && item.length <= maxLength
    && item.trim() === item
    && !Array.from(item).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    });

  if (!isBoundedText(event.id, 255)
    || !isBoundedText(event.provider, 64)
    || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(event.provider)
    || !isBoundedText(event.eventType, 255)
    || typeof event.rawPayload !== 'string'
    || event.rawPayload.length === 0
    || Buffer.byteLength(event.rawPayload, 'utf8') > MAX_BILLING_WEBHOOK_BYTES) {
    throw new BillingWebhookInputError();
  }

  for (const key of ['customerId', 'subscriptionId'] as const) {
    const identifier = event[key];
    if (identifier !== undefined && !isBoundedText(identifier, 255)) throw new BillingWebhookInputError();
  }
  if (event.status !== undefined && (typeof event.status !== 'string' || !SUBSCRIPTION_STATUSES.has(event.status))) {
    throw new BillingWebhookInputError();
  }
  if (event.planId !== undefined && (typeof event.planId !== 'string' || !BILLING_PLAN_IDS.has(event.planId))) {
    throw new BillingWebhookInputError();
  }

  for (const key of ['periodStart', 'periodEnd'] as const) {
    const period = event[key];
    if (period !== undefined && (typeof period !== 'string' || !Number.isFinite(Date.parse(period)))) {
      throw new BillingWebhookInputError();
    }
  }
  if (typeof event.periodStart === 'string' && typeof event.periodEnd === 'string'
    && Date.parse(event.periodEnd) <= Date.parse(event.periodStart)) {
    throw new BillingWebhookInputError();
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

  async verifyAndParseWebhook(rawBody: string, signature: string): Promise<BillingWebhookEvent> {
    if (process.env.NODE_ENV === 'production') throw new BillingProviderUnavailableError();

    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) throw new BillingProviderUnavailableError();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BILLING_WEBHOOK_BYTES) throw new BillingWebhookInputError();

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

    const event: BillingWebhookEvent = {
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
    assertNormalizedBillingWebhookEvent(event);
    return event;
  }
}

export function getBillingProvider(): BillingProvider {
  if (process.env.NODE_ENV === 'production') throw new BillingProviderUnavailableError();
  return new MockBillingProvider();
}
