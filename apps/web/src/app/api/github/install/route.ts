import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  getDefaultWorkspaceForUser,
  isWorkspaceAuthorizationError,
  requireWorkspaceMember,
} from '@/lib/server/workspace-service';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  const urlObj = new URL(req.url);
  const requestedWorkspaceId = urlObj.searchParams.get('workspaceId');

  let workspaceId: string;
  if (requestedWorkspaceId) {
    try {
      const ws = await requireWorkspaceMember(user.id, requestedWorkspaceId);
      workspaceId = ws.id;
    } catch {
      return NextResponse.json({ error: 'Workspace not found or access denied.', code: 'FORBIDDEN' }, { status: 403, headers: PRIVATE_NO_STORE });
    }
  } else {
    try {
      const defaultWs = await getDefaultWorkspaceForUser(user.id);
      workspaceId = defaultWs.id;
    } catch (error: unknown) {
      if (isWorkspaceAuthorizationError(error)) {
        return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403, headers: PRIVATE_NO_STORE });
      }
      throw error;
    }
  }

  let installUrlLimit;
  try {
    installUrlLimit = await checkRateLimit(
      `github:install-url:user:${user.id}`,
      10,
      15 * 60 * 1000,
      { failClosed: true },
    );
  } catch {
    return NextResponse.json(
      { error: 'GitHub installation is temporarily unavailable.', code: 'RATE_LIMIT_STORE_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_NO_STORE },
    );
  }
  if (!installUrlLimit.allowed) {
    const response = rateLimitResponse(installUrlLimit.resetInMs);
    response.headers.set('Cache-Control', PRIVATE_NO_STORE['Cache-Control']);
    return response;
  }

  try {
    const installUrl = await getGitHubAppInstallUrl(user.id, workspaceId);
    return NextResponse.json({ url: installUrl, workspaceId }, { headers: PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json(
      { error: 'GitHub installation could not be started.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
