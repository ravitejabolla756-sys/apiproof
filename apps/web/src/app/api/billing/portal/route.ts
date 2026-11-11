import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDefaultWorkspaceForUser, requireWorkspaceCapability } from '@/lib/server/workspace-service';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await getDefaultWorkspaceForUser(user.id);
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
