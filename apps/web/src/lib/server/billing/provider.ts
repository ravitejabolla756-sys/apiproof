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
    const secret = process.env.BILLING_WEBHOOK_SECRET || 'mock_webhook_secret';
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!signature || signature.length !== hmac.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) {
      throw new Error('INVALID_BILLING_SIGNATURE: Webhook HMAC verification failed');
    }

    const payload = JSON.parse(rawBody);
    return {
      id: payload.id || `evt_${crypto.randomBytes(8).toString('hex')}`,
      provider: 'mock',
      eventType: payload.type || payload.event_type || 'unknown',
      customerId: payload.data?.object?.customer || payload.customer_id,
      subscriptionId: payload.data?.object?.id || payload.subscription_id,
      status: payload.data?.object?.status || payload.status,
      planId: payload.data?.object?.items?.data?.[0]?.price?.nickname || payload.plan_id,
      periodStart: payload.data?.object?.current_period_start ? new Date(payload.data.object.current_period_start * 1000).toISOString() : payload.period_start,
      periodEnd: payload.data?.object?.current_period_end ? new Date(payload.data.object.current_period_end * 1000).toISOString() : payload.period_end,
      rawPayload: rawBody,
    };
  }
}

export function getBillingProvider(): BillingProvider {
  return new MockBillingProvider();
}
