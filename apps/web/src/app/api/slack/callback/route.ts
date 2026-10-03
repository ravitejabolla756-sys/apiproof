import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { consumeSlackOAuthState, exchangeSlackOAuthCode, saveSlackConnection } from '@/lib/server/slack-oauth.js';

function redirect(req: Request, result: 'connected' | 'error') {
  const response = NextResponse.redirect(new URL(`/dashboard/settings?slack=${result}`, req.url));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return redirect(req, 'error');
  const url = new URL(req.url);
  const state = url.searchParams.get('state') ?? '';
  const ownedState = await consumeSlackOAuthState(state, user.id);
  if (!ownedState) return redirect(req, 'error');
  if (url.searchParams.has('error')) return redirect(req, 'error');
  const code = url.searchParams.get('code');
  if (!code) return redirect(req, 'error');
  try {
    const connection = await exchangeSlackOAuthCode(code);
    await saveSlackConnection(connection, ownedState.workspaceId, user.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`INSERT INTO activity_events (id, user_id, type, title, description, created_at)
      VALUES (?, ?, 'slack_connected', 'Slack Connected', 'Connected Slack notifications to the authenticated workspace.', ?)`,
    [`act_${crypto.randomBytes(10).toString('hex')}`, user.id, now]);
    return redirect(req, 'connected');
  } catch {
    // OAuth tokens and provider response bodies are intentionally not logged or returned.
    return redirect(req, 'error');
  }
}
