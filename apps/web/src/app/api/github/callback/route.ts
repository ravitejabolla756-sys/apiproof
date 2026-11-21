import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import type { DatabaseAdapter } from '@/lib/server/db/types.js';
import {
  getPendingGitHubInstallationState,
  inspectGitHubInstallationState,
  verifyAndConsumeGitHubInstallationState,
  verifyGitHubAppInstallation,
} from '@/lib/server/github.js';
import { requireWorkspaceMember, requireWorkspaceOwner } from '@/lib/server/workspace-service.js';
import { evaluateVerifiedUserPolicy, loadVerifiedUserPolicy, verifiedUserFailure } from '@/lib/server/verified-user-policy.js';

function callbackFailure(req: Request, status: number, code: string, error: string) {
  if ((req.headers.get('accept') || '').includes('text/html')) {
    const location = new URL('/dashboard/settings', req.url);
    location.searchParams.set('github', 'error');
    location.searchParams.set('code', code);
    const response = NextResponse.redirect(location);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  return NextResponse.json({ error, code }, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function GET(req: Request) {
  try {
    // 1. Authenticate APIProof session
    const user = await getCurrentUser(req);
    if (!user) {
      return callbackFailure(req, 401, 'UNAUTHORIZED', 'Session required for GitHub installation callback.');
    }

    const verification = evaluateVerifiedUserPolicy(await loadVerifiedUserPolicy(user.id, 'provider_link'));
    const verificationFailure = verifiedUserFailure(verification);
    if (verificationFailure) return callbackFailure(req, verificationFailure.status, verificationFailure.code, verificationFailure.error);

    const urlObj = new URL(req.url);
    const installationId = urlObj.searchParams.get('installation_id');
    const setupAction = urlObj.searchParams.get('setup_action');
    let state = urlObj.searchParams.get('state');

  // 2. Validate callback parameters
  if (!installationId || !/^\d+$/.test(installationId.trim())) {
    return callbackFailure(req, 400, 'INVALID_CALLBACK', 'Invalid or missing installation_id parameter.');
  }

  if (!state || typeof state !== 'string' || state.trim().length === 0) {
    if (setupAction === 'update') state = await getPendingGitHubInstallationState(user.id);
    if (!state || state.trim().length === 0) {
      return callbackFailure(req, 400, 'INVALID_CALLBACK_STATE', setupAction === 'update'
        ? 'GitHub returned an installation update without a recoverable connection request. Start Connect GitHub again from MY OWL.'
        : 'Missing state parameter. Start GitHub connection again from workspace settings.');
    }
  }

  // 3 & 4. Validate state (bound to user and workspace, single-use, unexpired)
  // Ownership preflight must not consume the one-time state. A rejected
  // cross-workspace callback must remain retryable after authorized repair.
  const stateVerification = await inspectGitHubInstallationState(state.trim(), user.id);
  if (!stateVerification.valid || !stateVerification.workspaceId) {
    const code = stateVerification.errorCode === 'INVALID_STATE'
      ? 'INVALID_CALLBACK_STATE'
      : (stateVerification.errorCode || 'INVALID_CALLBACK_STATE');
    return callbackFailure(req, 400, code, stateVerification.error || 'Invalid callback state.');
  }

  const workspaceId = stateVerification.workspaceId;

  // Verify membership in resolved workspace
  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch {
    return callbackFailure(req, 403, 'FORBIDDEN', 'Workspace access denied.');
  }

  // 5 & 6. Verify GitHub installation belongs to this GitHub App and fetch authoritative metadata
  let installationMeta;
  try {
    installationMeta = await verifyGitHubAppInstallation(installationId.trim());
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('GITHUB_INSTALLATION_APP_MISMATCH') || errorMsg.includes('GITHUB_INSTALLATION_NOT_FOUND')) {
      return callbackFailure(req, 400, 'UNKNOWN_INSTALLATION', 'Installation does not belong to the authorized APIProof GitHub App.');
    }
    // Do not echo provider or configuration details to the browser. They can
    // contain deployment-specific information and are not actionable there.
    console.error('[github-callback] installation verification failed', {
      code: 'GITHUB_API_ERROR',
      errorType: err instanceof Error ? err.name : typeof err,
    });
    return callbackFailure(req, 502, 'GITHUB_API_ERROR', 'GitHub installation verification is temporarily unavailable.');
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
      await requireWorkspaceOwner(user.id, workspaceId);
    } catch {
      return callbackFailure(req, 403, 'FORBIDDEN', 'Action requires workspace owner privileges on target workspace.');
    }

    try {
      await requireWorkspaceOwner(user.id, existingRecord.workspace_id);
    } catch {
      return callbackFailure(req, 409, 'INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE', 'This GitHub installation is already associated with another workspace.');
    }
  }

  const consumedState = await verifyAndConsumeGitHubInstallationState(state.trim(), user.id);
  if (!consumedState.valid || consumedState.workspaceId !== workspaceId) {
    return callbackFailure(req, 400, consumedState.errorCode || 'INVALID_CALLBACK_STATE', consumedState.error || 'Invalid callback state.');
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
      user.id,
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
  } catch (error: unknown) {
    // Never turn a deployment/database configuration problem into a generic
    // platform 500 page. Keep the response generic and avoid logging state,
    // cookies, request URLs, connection strings, or provider payloads.
    console.error('[github-callback] request failed', {
      code: 'GITHUB_CALLBACK_UNAVAILABLE',
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return callbackFailure(req, 503, 'GITHUB_CALLBACK_UNAVAILABLE', 'GitHub connection is temporarily unavailable. Check the deployment configuration and try again.');
  }
}

export async function POST(req: Request) {
  return GET(req);
}
