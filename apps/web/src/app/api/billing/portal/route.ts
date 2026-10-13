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

  const rateCheck = await checkRateLimit(`billing:portal:${user.id}`, 5, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

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
