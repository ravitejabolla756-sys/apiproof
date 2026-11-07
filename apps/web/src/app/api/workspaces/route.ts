import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { getUserWorkspaces } from '@/lib/server/workspace-service.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaces = await getUserWorkspaces(user.id);
  const activeWorkspace = await resolveWorkspaceForRequest(req, user.id);
  return NextResponse.json(
    { workspaces, activeWorkspaceId: activeWorkspace.id },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
