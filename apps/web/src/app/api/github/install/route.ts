import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getGitHubAppInstallUrl } from '@/lib/server/github';
import {
  getDefaultWorkspaceForUser,
  requireWorkspaceCapability,
} from '@/lib/server/workspace-service';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { evaluateVerifiedUserPolicy, loadVerifiedUserPolicy, verifiedUserFailure } from '@/lib/server/verified-user-policy.js';

export async function GET(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
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
    const defaultWs = await getDefaultWorkspaceForUser(user.id);
    await requireWorkspaceCapability(user.id, defaultWs.id, 'integration:manage');
    workspaceId = defaultWs.id;
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
