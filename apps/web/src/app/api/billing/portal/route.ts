import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { requireWorkspaceCapability } from '@/lib/server/workspace-service';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { OrganizationServiceError } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    await requireWorkspaceCapability(user.id, workspace.id, 'billing:manage');
    return NextResponse.json({ error: 'Billing portal is unavailable in this beta.', code: 'BILLING_PORTAL_CONTRACT_PENDING' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof OrganizationServiceError || (error instanceof Error && error.message.includes('access denied'))) {
      return organizationErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Billing access denied.', code: error.message }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: 'Billing portal is temporarily unavailable.', code: 'BILLING_PORTAL_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
