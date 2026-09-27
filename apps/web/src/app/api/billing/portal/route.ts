import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDefaultWorkspaceForUser } from '@/lib/server/workspace-service';
import { getWorkspaceSubscription } from '@/lib/server/billing/service';
import { getBillingProvider } from '@/lib/server/billing/provider';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await getDefaultWorkspaceForUser(user.id);
  const sub = await getWorkspaceSubscription(workspace.id);
  const provider = getBillingProvider();

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
