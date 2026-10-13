import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../../../../lib/server/workspace-service.js';
import { getWorkspaceSubscription } from '../../../../lib/server/billing/service.js';
import { getBillingProvider } from '../../../../lib/server/billing/provider.js';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/server/rate-limit.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '../../../../lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(`billing:checkout:${user.id}`, 5, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  const workspace = await getDefaultWorkspaceForUser(user.id);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const planId = body.planId;

  if (!planId || typeof planId !== 'string') {
    return NextResponse.json({ error: 'INVALID_PLAN: Plan ID is required.' }, { status: 400 });
  }

  const sub = await getWorkspaceSubscription(workspace.id);
  const provider = getBillingProvider();

  let customerId = sub.customerId;
  if (!customerId) {
    const res = await provider.createCustomer(workspace.id, user.email, user.name);
    customerId = res.customerId;
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000';
  const returnUrl = `${origin}/dashboard/settings`;

  const checkout = await provider.createCheckoutSession(workspace.id, customerId, planId, returnUrl);

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    planId,
  });
}
