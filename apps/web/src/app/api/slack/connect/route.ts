import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { createSlackAuthorizationUrl } from '@/lib/server/slack-oauth.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const url = await createSlackAuthorizationUrl(user.id, workspace.id);
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('access denied') || 'code' in error)) {
      const response = organizationErrorResponse(error);
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
      return response;
    }
    const code = error instanceof Error ? error.message : 'SLACK_CONNECTION_UNAVAILABLE';
    return NextResponse.json({ error: code }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
