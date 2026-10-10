import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import {
  getDefaultWorkspaceForUser,
  requireWorkspaceMember,
} from '@/lib/server/workspace-service';
import { logger, safeErrorCode } from '@/lib/server/logger.js';

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
    const defaultWs = await getDefaultWorkspaceForUser(user.id);
    workspaceId = defaultWs.id;
  }

  try {
    const installUrl = await getGitHubAppInstallUrl(user.id, workspaceId);
    return NextResponse.json({ url: installUrl, workspaceId });
  } catch (error: unknown) {
    logger.warn('github_install_url_generation_failed', { reasonCode: safeErrorCode(error, 'GITHUB_INSTALL_FAILED') }, error);
    return NextResponse.json({ error: 'Unable to start GitHub installation right now.', code: 'GITHUB_INSTALL_FAILED' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
