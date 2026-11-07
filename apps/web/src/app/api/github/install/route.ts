import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import {
  getDefaultWorkspaceForUser,
  isWorkspaceAuthorizationError,
  requireWorkspaceMember,
} from '@/lib/server/workspace-service';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const urlObj = new URL(req.url);
  const requestedWorkspaceId = urlObj.searchParams.get('workspaceId');

  let workspaceId: string;
  if (requestedWorkspaceId) {
    try {
      const ws = await requireWorkspaceMember(user.id, requestedWorkspaceId);
      workspaceId = ws.id;
    } catch {
      return NextResponse.json({ error: 'Workspace not found or access denied.', code: 'FORBIDDEN' }, { status: 403 });
    }
  } else {
    try {
      const defaultWs = await getDefaultWorkspaceForUser(user.id);
      workspaceId = defaultWs.id;
    } catch (error: unknown) {
      if (isWorkspaceAuthorizationError(error)) {
        return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403 });
      }
      throw error;
    }
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
