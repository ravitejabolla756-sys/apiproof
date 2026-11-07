import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError } from '@/lib/server/workspace-service.js';
import { getWorkspaceSubscription } from '@/lib/server/billing/service.js';
import { BillingProviderUnavailableError, getBillingProvider } from '../../../../lib/server/billing/provider.js';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspace: Awaited<ReturnType<typeof getDefaultWorkspaceForUser>>;
  try {
    workspace = await getDefaultWorkspaceForUser(user.id);
  } catch (error: unknown) {
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403 });
    }
    throw error;
  }
  const sub = await getWorkspaceSubscription(workspace.id);
  let provider;
  try {
    provider = getBillingProvider();
  } catch (error) {
    if (error instanceof BillingProviderUnavailableError) {
      return NextResponse.json({ error: 'Billing portal is unavailable' }, { status: 503 });
    }
    throw error;
  }

  let customerId = sub.customerId;
  if (!customerId) {
    const res = await provider.createCustomer(workspace.id, user.email, user.name);
    customerId = res.customerId;
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000';
  const returnUrl = `${origin}/dashboard/settings`;

  const portal = await provider.createPortalSession(customerId, returnUrl);

  return NextResponse.json({
    portalUrl: portal.portalUrl,
  });
}
