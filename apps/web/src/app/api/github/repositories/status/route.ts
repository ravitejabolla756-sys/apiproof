import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/server/auth.js';
import { resolveWorkspaceForRequest } from '../../../../../lib/server/organization-route.js';
import {
  getWorkspaceGitHubInstallation,
  requireWorkspaceMember,
} from '../../../../../lib/server/workspace-service.js';

/** Lightweight status check for cross-tab OAuth synchronization; does not call GitHub. */
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

  const requestedWorkspaceId = new URL(req.url).searchParams.get('workspaceId');
  let workspaceId: string;
  if (requestedWorkspaceId) {
    try {
      workspaceId = (await requireWorkspaceMember(user.id, requestedWorkspaceId)).id;
    } catch {
      return NextResponse.json({ error: 'Workspace access denied.' }, { status: 403, headers });
    }
  } else {
    workspaceId = (await resolveWorkspaceForRequest(req, user.id)).id;
  }

  const installation = await getWorkspaceGitHubInstallation(workspaceId);
  return NextResponse.json({ connected: Boolean(installation) }, { headers });
}
