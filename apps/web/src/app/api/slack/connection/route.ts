import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { requireWorkspaceCapability } from '@/lib/server/workspace-service.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { OrganizationServiceError } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const row = await getDatabase().queryOne<{ team_name: string; connected_at: string }>(`
      SELECT team_name, connected_at FROM slack_connections WHERE workspace_id = ? AND status = 'active'
    `, [workspace.id]);
    return NextResponse.json({ connected: Boolean(row), teamName: row?.team_name, connectedAt: row?.connected_at }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof OrganizationServiceError || (error instanceof Error && error.message.includes('access denied'))) {
      return organizationErrorResponse(error);
    }
    return NextResponse.json({ error: 'Slack connection status is temporarily unavailable.', code: 'SLACK_STATUS_UNAVAILABLE' }, { status: 503, headers: privateHeaders });
  }
}

export async function DELETE(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'provider_link');
  if (verificationFailure) return verificationFailure;
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    await requireWorkspaceCapability(user.id, workspace.id, 'integration:manage');
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
  } catch (error) {
    if (error instanceof OrganizationServiceError || (error instanceof Error && error.message.includes('access denied'))) {
      return organizationErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Slack management access denied.', code: error.message }, { status: 403, headers: privateHeaders });
    }
    return NextResponse.json({ error: 'Slack connection could not be updated.', code: 'SLACK_CONNECTION_UNAVAILABLE' }, { status: 503, headers: privateHeaders });
  }
}
