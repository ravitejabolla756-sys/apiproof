import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import { PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import {
  requireWorkspaceCapability,
} from '@/lib/server/workspace-service';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { evaluateVerifiedUserPolicy, loadVerifiedUserPolicy, verifiedUserFailure } from '@/lib/server/verified-user-policy.js';

export async function GET(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const verification = evaluateVerifiedUserPolicy(await loadVerifiedUserPolicy(user.id, 'provider_link'));
  const verificationFailure = verifiedUserFailure(verification);
  if (verificationFailure) return NextResponse.json(verificationFailure, { status: verificationFailure.status });

  const urlObj = new URL(req.url);
  const requestedWorkspaceId = urlObj.searchParams.get('workspaceId');

  let workspaceId: string;
  if (requestedWorkspaceId) {
    try {
      const ws = await requireWorkspaceCapability(user.id, requestedWorkspaceId, 'integration:manage');
      workspaceId = ws.id;
    } catch {
      return NextResponse.json({ error: 'Workspace not found or access denied.', code: 'FORBIDDEN' }, { status: 403 });
    }
  } else {
    const activeWorkspace = await resolveWorkspaceForRequest(req, user.id);
    await requireWorkspaceCapability(user.id, activeWorkspace.id, 'integration:manage');
    workspaceId = activeWorkspace.id;
  }

  try {
    const installUrl = await getGitHubAppInstallUrl(user.id, workspaceId);
    return NextResponse.json({ url: installUrl, workspaceId }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    console.error('GitHub installation URL request failed:', { code: 'GITHUB_INSTALL_UNAVAILABLE' });
    return NextResponse.json({ error: 'GitHub installation is temporarily unavailable.', code: 'GITHUB_INSTALL_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
