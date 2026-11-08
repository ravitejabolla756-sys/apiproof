import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/server/auth.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '../../../../../lib/server/organization-route.js';
import { getWorkspaceGitHubInstallation } from '../../../../../lib/server/workspace-service.js';

/** Lightweight status check for cross-tab OAuth synchronization; does not call GitHub. */
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

  let workspaceId: string;
  try {
    workspaceId = (await resolveWorkspaceForRequest(req, user.id)).id;
  } catch (error) {
    const response = organizationErrorResponse(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }

  const installation = await getWorkspaceGitHubInstallation(workspaceId);
  return NextResponse.json({ connected: Boolean(installation) }, { headers });
}
