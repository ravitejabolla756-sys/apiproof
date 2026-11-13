import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/server/auth.js';
import { isWorkspaceAuthorizationError, requireWorkspaceCapability } from '../../../../lib/server/workspace-service.js';
import { PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '../../../../lib/server/organization-route.js';
import { getWorkspaceSubscription, persistWorkspaceCustomerId } from '../../../../lib/server/billing/service.js';
import { BillingProviderUnavailableError, getBillingProvider } from '../../../../lib/server/billing/provider.js';
import { PLANS } from '../../../../lib/server/billing/plans.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '../../../../lib/server/validation.js';
import { verifiedUserRouteFailure } from '../../../../lib/server/verified-user-route.js';
import { validateEnvConfig } from '../../../../lib/server/env-config.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

  let workspace: Awaited<ReturnType<typeof requireWorkspaceCapability>>;
  try {
    const requestedWorkspace = await resolveWorkspaceForRequest(req, user.id);
    workspace = await requireWorkspaceCapability(user.id, requestedWorkspace.id, 'billing:manage');
  } catch (error) {
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Billing access denied.', code: 'WORKSPACE_BILLING_ACCESS_DENIED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    throw error;
  }
  const body = (await req.json().catch(() => ({}))) as { planId?: unknown };
  const planId = body.planId;

  if (!planId || typeof planId !== 'string') {
    return NextResponse.json({ error: 'INVALID_PLAN: Plan ID is required.' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  if (!Object.hasOwn(PLANS, planId) || planId === 'free' || planId === 'enterprise') {
    return NextResponse.json({ error: 'INVALID_PLAN: Select a purchasable subscription plan.' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  // Paid plans are intentionally display-only during the public beta.
  if (planId === 'pro' || planId === 'team') {
    return NextResponse.json(
      { error: 'BILLING_NOT_AVAILABLE: Paid plans are rolling out and cannot be purchased yet.' },
      { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const sub = await getWorkspaceSubscription(workspace.id);
  const provider = getBillingProvider();
  let returnUrl: string;
  try {
    const configuredUrl = validateEnvConfig().config.appUrl;
    returnUrl = `${new URL(configuredUrl).origin}/dashboard/settings`;
  } catch {
    return NextResponse.json({ error: 'Billing return URL is unavailable.', code: 'BILLING_RETURN_URL_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    let customerId = sub.customerId;
    if (!customerId) {
      const res = await provider.createCustomer(workspace.id, user.email, user.name);
      customerId = res.customerId;
      await persistWorkspaceCustomerId(workspace.id, customerId);
    }

    const checkout = await provider.createCheckoutSession(workspace.id, customerId, planId, returnUrl);

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl, planId }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof BillingProviderUnavailableError || (error instanceof Error && error.message.startsWith('BILLING_PROVIDER_UNAVAILABLE'))) {
      return NextResponse.json({ error: 'Billing is unavailable until an approved provider is configured.', code: 'BILLING_PROVIDER_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    throw error;
  }
}
