import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { createSlackAuthorizationUrl } from '@/lib/server/slack-oauth.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'provider_link');
  if (verificationFailure) return verificationFailure;
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const url = await createSlackAuthorizationUrl(user.id, workspace.id);
    return NextResponse.json({ url }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SLACK_CONNECTION_UNAVAILABLE';
    if (code.includes('access denied')) return NextResponse.json({ error: 'Workspace access denied.', code: 'WORKSPACE_ACCESS_DENIED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    console.error('Slack connect request failed:', { code: 'SLACK_CONNECTION_UNAVAILABLE' });
    return NextResponse.json({ error: 'Slack connection is temporarily unavailable.', code: 'SLACK_CONNECTION_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
