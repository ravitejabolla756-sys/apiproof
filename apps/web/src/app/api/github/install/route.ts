import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import { getEmailVerificationStatus, isEmailVerificationConfigured } from '@/lib/server/email-verification.js';
import {
  getDefaultWorkspaceForUser,
  requireWorkspaceMember,
} from '@/lib/server/workspace-service';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const verification = await getEmailVerificationStatus(user.id);
    if (verification !== 'verified') {
      if (!isEmailVerificationConfigured()) {
        return NextResponse.json(
          { error: 'Email verification is temporarily unavailable.', code: 'EMAIL_VERIFICATION_UNAVAILABLE' },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: 'Verify your email before connecting GitHub.', code: 'EMAIL_VERIFICATION_REQUIRED' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Account verification could not be checked right now.', code: 'EMAIL_VERIFICATION_CHECK_FAILED' },
      { status: 503 },
    );
  }

  const urlObj = new URL(req.url);
  const requestedWorkspaceId = urlObj.searchParams.get('workspaceId');

  try {
    let workspaceId: string;
    if (requestedWorkspaceId) {
      const ws = await requireWorkspaceMember(user.id, requestedWorkspaceId);
      workspaceId = ws.id;
    } else {
      const defaultWs = await getDefaultWorkspaceForUser(user.id);
      workspaceId = defaultWs.id;
    }
    const installUrl = await getGitHubAppInstallUrl(user.id, workspaceId);
    return NextResponse.json({ url: installUrl, workspaceId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate GitHub installation URL.';
    const code = message.includes('Workspace') || message.includes('workspace')
      ? 'WORKSPACE_UNAVAILABLE'
      : 'GITHUB_INSTALL_UNAVAILABLE';
    console.error('[github-install] Failed to prepare installation:', message);
    return NextResponse.json({ error: 'GitHub connection is temporarily unavailable. Please try again.', code }, { status: 503 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
