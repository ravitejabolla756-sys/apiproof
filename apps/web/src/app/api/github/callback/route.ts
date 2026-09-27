import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import {
  verifyAndConsumeGitHubInstallationState,
  verifyGitHubAppInstallation,
} from '@/lib/server/github';
import { requireWorkspaceMember } from '@/lib/server/workspace-service';

export async function GET(req: Request) {
  // 1. Authenticate APIProof session
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Session required for installation callback.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const urlObj = new URL(req.url);
  const installationId = urlObj.searchParams.get('installation_id');
  const state = urlObj.searchParams.get('state');

  // 2. Validate callback parameters
  if (!installationId || !/^\d+$/.test(installationId.trim())) {
    return NextResponse.json({ error: 'Invalid or missing installation_id parameter.', code: 'INVALID_CALLBACK' }, { status: 400 });
  }

  if (!state || typeof state !== 'string' || state.trim().length === 0) {
    return NextResponse.json({ error: 'Missing state parameter.', code: 'INVALID_CALLBACK_STATE' }, { status: 400 });
  }

  // 3 & 4. Validate state (bound to user and workspace, single-use, unexpired)
  const stateVerification = await verifyAndConsumeGitHubInstallationState(state.trim(), user.id);
  if (!stateVerification.valid || !stateVerification.workspaceId) {
    const code = stateVerification.errorCode === 'INVALID_STATE'
      ? 'INVALID_CALLBACK_STATE'
      : (stateVerification.errorCode || 'INVALID_CALLBACK_STATE');
    return NextResponse.json({
      error: stateVerification.error || 'Invalid callback state.',
      code,
    }, { status: 400 });
  }

  const workspaceId = stateVerification.workspaceId;

  // Verify membership in resolved workspace
  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch {
    return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403 });
  }

  // 5 & 6. Verify GitHub installation belongs to this GitHub App and fetch authoritative metadata
  let installationMeta;
  try {
    installationMeta = await verifyGitHubAppInstallation(installationId.trim());
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('GITHUB_INSTALLATION_APP_MISMATCH') || errorMsg.includes('GITHUB_INSTALLATION_NOT_FOUND')) {
      return NextResponse.json({
        error: 'Installation does not belong to the authorized APIProof GitHub App.',
        code: 'UNKNOWN_INSTALLATION',
      }, { status: 400 });
    }
    return NextResponse.json({
      error: `GitHub API error validating installation: ${errorMsg}`,
      code: 'GITHUB_API_ERROR',
    }, { status: 502 });
  }

  const cleanInstallationId = installationId.trim();
  const db = getDatabase();

  // 5 & 10. Check if installation already belongs to another workspace (Installation Ownership Rule)
  const existingRecord = await db.queryOne<{ id: string; workspace_id: string }>(`
    SELECT id, workspace_id FROM github_installations WHERE installation_id = ?
  `, [cleanInstallationId]);

  if (existingRecord) {
    if (existingRecord.workspace_id !== workspaceId) {
      return NextResponse.json({
        error: 'This GitHub installation is already associated with another workspace.',
        code: 'INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE',
      }, { status: 409 });
    }
  }

  const now = new Date().toISOString();

  // 7 & 8. Persist/update github_installations associated with the authenticated workspace
  if (existingRecord) {
    await db.execute(`
      UPDATE github_installations
      SET account_login = ?, account_type = ?, updated_at = ?
      WHERE id = ?
    `, [installationMeta.accountLogin, installationMeta.accountType, now, existingRecord.id]);
  } else {
    const installationRecordId = `ghi_${crypto.randomBytes(10).toString('hex')}`;
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      installationRecordId,
      workspaceId,
      cleanInstallationId,
      installationMeta.accountLogin,
      installationMeta.accountType,
      now,
      now,
    ]);
  }

  // Activity event
  await db.execute(`
    INSERT INTO activity_events (id, user_id, type, title, description, created_at)
    VALUES (?, ?, 'github_connected', 'GitHub Connected', ?, ?)
  `, [
    `act_${crypto.randomBytes(10).toString('hex')}`,
    user.id,
    `Connected GitHub account ${installationMeta.accountLogin} (${installationMeta.accountType}).`,
    now,
  ]);

  const acceptHeader = req.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    return NextResponse.redirect(new URL('/dashboard/settings?github=connected', req.url));
  }

  return NextResponse.json({
    success: true,
    workspaceId,
    installationId: cleanInstallationId,
    accountLogin: installationMeta.accountLogin,
    accountType: installationMeta.accountType,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
