import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { listWorkspaceAuditEvents } from '@/lib/server/organization-service.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    return NextResponse.json({ events: await listWorkspaceAuditEvents(user.id, workspace.id) });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
