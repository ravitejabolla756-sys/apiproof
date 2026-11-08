import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { createSlackAuthorizationUrl } from '@/lib/server/slack-oauth.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = await createSlackAuthorizationUrl(user.id);
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Slack connection could not be started.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
