import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getGitHubAppInstallUrl } from '@/lib/server/github.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let workspaceId: string;
  try {
    workspaceId = (await resolveWorkspaceForRequest(req, user.id)).id;
  } catch (error) {
    return organizationErrorResponse(error);
  }

  try {
    const installUrl = await getGitHubAppInstallUrl(user.id, workspaceId);
    return NextResponse.json({ url: installUrl, workspaceId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate GitHub installation URL.';
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
