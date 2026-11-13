import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { requireWorkspaceCapability } from '@/lib/server/workspace-service';
import { resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await resolveWorkspaceForRequest(req, user.id);
  try {
    await requireWorkspaceCapability(user.id, workspace.id, 'billing:manage');
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Billing access denied.', code: error.message }, { status: 403 });
    }
    throw error;
  }
  return NextResponse.json({ error: 'Billing portal is unavailable in this beta.', code: 'BILLING_PORTAL_CONTRACT_PENDING' }, { status: 403 });
}
