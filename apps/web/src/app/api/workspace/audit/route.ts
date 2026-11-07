import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { listWorkspaceAuditPage } from '@/lib/server/organization-service.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const cursor = new URL(req.url).searchParams.get('cursor') || undefined;
    const page = await listWorkspaceAuditPage(user.id, workspace.id, cursor);
    return NextResponse.json(page);
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
