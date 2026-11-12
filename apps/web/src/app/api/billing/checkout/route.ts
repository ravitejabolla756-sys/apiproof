import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/server/auth.js';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError, requireWorkspaceCapability } from '../../../../lib/server/workspace-service.js';
import { getWorkspaceSubscription } from '../../../../lib/server/billing/service.js';
import { getBillingProvider } from '../../../../lib/server/billing/provider.js';
import { PLANS } from '../../../../lib/server/billing/plans.js';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspace: Awaited<ReturnType<typeof requireWorkspaceCapability>>;
  try {
    const defaultWorkspace = await getDefaultWorkspaceForUser(user.id);
    workspace = await requireWorkspaceCapability(user.id, defaultWorkspace.id, 'billing:manage');
  } catch (error) {
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Billing access denied.', code: 'WORKSPACE_BILLING_ACCESS_DENIED' }, { status: 403 });
    }
    throw error;
  }
  const body = (await req.json().catch(() => ({}))) as { planId?: unknown };
  const planId = body.planId;

  if (!planId || typeof planId !== 'string') {
    return NextResponse.json({ error: 'INVALID_PLAN: Plan ID is required.' }, { status: 400 });
  }

  if (!Object.hasOwn(PLANS, planId) || planId === 'free' || planId === 'enterprise') {
    return NextResponse.json({ error: 'INVALID_PLAN: Select a purchasable subscription plan.' }, { status: 400 });
  }

  // Paid plans are intentionally display-only during the public beta.
  if (planId === 'pro' || planId === 'team') {
    return NextResponse.json(
      { error: 'BILLING_NOT_AVAILABLE: Paid plans are rolling out and cannot be purchased yet.' },
      { status: 403 },
    );
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
