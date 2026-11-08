import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    if (workspace.role !== 'owner') {
      return NextResponse.json({ error: 'BILLING_OWNER_REQUIRED: Only workspace owners can manage billing.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'BILLING_NOT_AVAILABLE: Customer billing portal is not enabled during the beta.' },
      { status: 403 },
    );
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
