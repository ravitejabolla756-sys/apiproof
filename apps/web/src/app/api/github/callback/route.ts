import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import type { DatabaseAdapter } from '@/lib/server/db/types.js';
import {
  inspectGitHubInstallationState,
  verifyAndConsumeGitHubInstallationState,
  verifyGitHubAppInstallation,
} from '@/lib/server/github.js';
import { requireWorkspaceMember, requireWorkspaceOwner } from '@/lib/server/workspace-service.js';
import { logger, safeErrorCode } from '@/lib/server/logger.js';

export async function GET(req: Request) {
  // GitHub may return to a different preview host than the one that started
  // installation, so the session cookie is not always present. The signed,
  // persisted, single-use state is the OAuth capability; a matching session,
  // when present, is still checked by inspectGitHubInstallationState.
  const user = await getCurrentUser(req);

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
  // Ownership preflight must not consume the one-time state. A rejected
  // cross-workspace callback must remain retryable after authorized repair.
  const stateVerification = await inspectGitHubInstallationState(state.trim(), user?.id);
  if (!stateVerification.valid || !stateVerification.workspaceId) {
    const code = stateVerification.errorCode === 'INVALID_STATE'
      ? 'INVALID_CALLBACK_STATE'
      : (stateVerification.errorCode || 'INVALID_CALLBACK_STATE');
    return NextResponse.json({
      error: stateVerification.error || 'Invalid callback state.',
      code,
    }, { status: 400 });
  }

  const callbackUserId = stateVerification.userId;
  if (!callbackUserId) {
    return NextResponse.json({ error: 'Invalid callback state.', code: 'INVALID_CALLBACK_STATE' }, { status: 400 });
  }

  const workspaceId = stateVerification.workspaceId;

  // Verify membership in resolved workspace
  try {
    await requireWorkspaceMember(callbackUserId, workspaceId);
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
    logger.warn('github_installation_validation_failed', { reasonCode: safeErrorCode(err, 'GITHUB_API_ERROR') }, err);
    return NextResponse.json({
      error: 'Unable to validate the GitHub installation right now.',
      code: 'GITHUB_API_ERROR',
    }, { status: 502 });
  }

  const cleanInstallationId = installationId.trim();
  const db = getDatabase();

  // 5 & 10. Check if installation already belongs to another workspace (Installation Ownership Rule)
  const existingRecord = await db.queryOne<{ id: string; workspace_id: string }>(`
    SELECT id, workspace_id FROM github_installations WHERE installation_id = ?
  `, [cleanInstallationId]);

  if (existingRecord && existingRecord.workspace_id !== workspaceId) {
    // Reassociation requested: verify caller owns BOTH target workspace and existing workspace
    try {
      await requireWorkspaceOwner(callbackUserId, workspaceId);
    } catch {
      return NextResponse.json({
        error: 'Action requires workspace owner privileges on target workspace.',
        code: 'FORBIDDEN',
      }, { status: 403 });
    }

    try {
      await requireWorkspaceOwner(callbackUserId, existingRecord.workspace_id);
    } catch {
      return NextResponse.json({
        error: 'This GitHub installation is already associated with another workspace.',
        code: 'INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE',
      }, { status: 409 });
    }
  }

  const consumedState = await verifyAndConsumeGitHubInstallationState(state.trim(), callbackUserId);
  if (!consumedState.valid || consumedState.workspaceId !== workspaceId) {
    return NextResponse.json({
      error: consumedState.error || 'Invalid callback state.',
      code: consumedState.errorCode || 'INVALID_CALLBACK_STATE',
    }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Persist/update github_installations and activity events transactionally
  await db.transaction(async (tx: DatabaseAdapter) => {
    if (existingRecord) {
      await tx.execute(`
        UPDATE github_installations
        SET workspace_id = ?, account_login = ?, account_type = ?, status = 'active', updated_at = ?
        WHERE id = ?
      `, [
        workspaceId,
        installationMeta.accountLogin,
        installationMeta.accountType,
        now,
        existingRecord.id,
      ]);
    } else {
      const installationRecordId = `ghi_${crypto.randomBytes(10).toString('hex')}`;
      await tx.execute(`
        INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
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

    const activityTitle = (existingRecord && existingRecord.workspace_id !== workspaceId)
      ? 'GitHub Reassociated'
      : 'GitHub Connected';
    const activityDesc = (existingRecord && existingRecord.workspace_id !== workspaceId)
      ? `Reassociated GitHub account ${installationMeta.accountLogin} (${installationMeta.accountType}) to workspace.`
      : `Connected GitHub account ${installationMeta.accountLogin} (${installationMeta.accountType}).`;

    await tx.execute(`
      INSERT INTO activity_events (id, user_id, type, title, description, created_at)
      VALUES (?, ?, 'github_connected', ?, ?, ?)
    `, [
      `act_${crypto.randomBytes(10).toString('hex')}`,
      callbackUserId,
      activityTitle,
      activityDesc,
      now,
    ]);
  });

  const acceptHeader = req.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    const response = NextResponse.redirect(new URL('/dashboard/settings?github=connected', req.url));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.json({
    success: true,
    workspaceId,
    installationId: cleanInstallationId,
    accountLogin: installationMeta.accountLogin,
    accountType: installationMeta.accountType,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function POST(req: Request) {
  return GET(req);
}
