import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

function workspaceErrorResponse(error: unknown): Response {
  const response = organizationErrorResponse(error);
  response.headers.set('Cache-Control', privateHeaders['Cache-Control']);
  return response;
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  let workspace: Awaited<ReturnType<typeof resolveWorkspaceForRequest>>;
  try {
    workspace = await resolveWorkspaceForRequest(req, user.id);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
  const row = await getDatabase().queryOne<{ team_name: string; connected_at: string }>(`
    SELECT team_name, connected_at FROM slack_connections WHERE workspace_id = ? AND status = 'active'
  `, [workspace.id]);
  return NextResponse.json({ connected: Boolean(row), teamName: row?.team_name, connectedAt: row?.connected_at }, { headers: privateHeaders });
}

export async function DELETE(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  let workspace: Awaited<ReturnType<typeof resolveWorkspaceForRequest>>;
  try {
    workspace = await resolveWorkspaceForRequest(req, user.id);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
  const now = new Date().toISOString();
  const db = getDatabase();
  const result = await db.execute(`UPDATE slack_connections SET status = 'revoked', token_ciphertext = '', token_iv = '', token_auth_tag = '', updated_at = ?
    WHERE workspace_id = ? AND status = 'active'`, [now, workspace.id]);
  if (result.changes) {
    await db.execute(`INSERT INTO activity_events (id, user_id, type, title, description, created_at)
      VALUES (?, ?, 'slack_disconnected', 'Slack Disconnected', 'Disconnected Slack notifications from the authenticated workspace.', ?)`,
    [`act_${crypto.randomBytes(10).toString('hex')}`, user.id, now]);
  }
  return NextResponse.json({ connected: false }, { headers: privateHeaders });
}
