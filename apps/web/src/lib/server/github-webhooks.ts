import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import {
  getGitHubInstallationByInstallationId,
  updateGitHubInstallationStatus,
} from './workspace-service.js';
import { getConfiguredFounderUserId, isLiveScanProtectionEnabled } from './founder-scan-authorization.js';

export interface WebhookResult {
  received: boolean;
  handled: boolean;
  deliveryId?: string | undefined;
  replayed?: boolean | undefined;
  reason?: string | undefined;
  scanRequestId?: string | undefined;
  status?: string | undefined;
  error?: string | undefined;
}

/**
 * Timing-safe HMAC-SHA256 signature verification for GitHub webhooks.
 * Computes HMAC against the raw request body.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody, 'utf8');
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    const sigBuffer = Buffer.from(signatureHeader, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Checks if a webhook delivery has already been processed (replay protection).
 */
export async function isDeliveryProcessed(deliveryId: string): Promise<boolean> {
  const db = getDatabase();
  const row = await db.queryOne<{ id: string; status: string }>(`
    SELECT id, status FROM github_webhook_deliveries WHERE id = ?
  `, [deliveryId]);

  return Boolean(row && (row.status === 'processed' || row.status === 'ignored'));
}

/**
 * Atomically reserves a delivery for processing. A unique delivery ID is the
 * idempotency key; only the request that inserts the row may execute it.
 */
export async function claimWebhookDelivery(
  deliveryId: string,
  event: string,
  receivedAt: string
): Promise<boolean> {
  const db = getDatabase();
  const result = await db.execute(`
    INSERT INTO github_webhook_deliveries (id, event, status, received_at, processed_at)
    VALUES (?, ?, 'processing', ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      event = excluded.event,
      status = 'processing',
      received_at = excluded.received_at,
      processed_at = excluded.processed_at,
      error_message = NULL
    WHERE github_webhook_deliveries.status = 'failed'
  `, [deliveryId, event, receivedAt, receivedAt]);
  return result.changes === 1;
}

/**
 * Records a delivery in github_webhook_deliveries table.
 */
export async function recordWebhookDelivery(
  deliveryId: string,
  event: string,
  status: 'processed' | 'ignored' | 'failed',
  receivedAt: string,
  errorMessage?: string
): Promise<void> {
  const db = getDatabase();
  const processedAt = new Date().toISOString();

  await db.execute(`
    INSERT INTO github_webhook_deliveries (id, event, status, received_at, processed_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      status = excluded.status,
      processed_at = excluded.processed_at,
      error_message = excluded.error_message
  `, [deliveryId, event, status, receivedAt, processedAt, errorMessage ?? null]);
}

/**
 * Gets the workspace primary user ID for activity event attribution.
 */
async function getWorkspaceUserId(workspaceId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.queryOne<{ user_id: string }>(`
    SELECT user_id FROM workspace_members
    WHERE workspace_id = ?
    ORDER BY CASE role WHEN 'owner' THEN 1 ELSE 2 END
    LIMIT 1
  `, [workspaceId]);
  return row?.user_id ?? null;
}

/**
 * Core event routing and processor for GitHub webhooks.
 * Fast, asynchronous-safe: VERIFY -> IDENTIFY -> PERSIST -> QUEUE -> ACKNOWLEDGE.
 */
export async function processGitHubWebhook(params: {
  event: string;
  deliveryId: string;
  rawBody: string;
}): Promise<WebhookResult> {
  const { event, deliveryId, rawBody } = params;
  const db = getDatabase();
  const now = new Date().toISOString();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await recordWebhookDelivery(deliveryId, event, 'failed', now, 'Invalid JSON body');
    return { received: true, handled: false, error: 'INVALID_JSON' };
  }

  // 1. Installation Events
  if (event === 'installation') {
    const action = String(payload.action ?? '');
    const instData = payload.installation as Record<string, unknown> | undefined;
    const installationId = instData ? String(instData.id ?? '') : '';

    if (!installationId) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Missing installation ID');
      return { received: true, handled: false, reason: 'missing_installation_id' };
    }

    if (action === 'created') {
      // Find workspace attached to this installation
      const installation = await getGitHubInstallationByInstallationId(installationId, { includeInactive: true });
      if (!installation) {
        // Do NOT guess workspace! Must originate from Phase 3A user installation flow
        await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Unresolved workspace for installation');
        return { received: true, handled: false, reason: 'unresolved_workspace' };
      }

      // Refresh metadata & ensure active
      const accountData = instData?.account as Record<string, unknown> | undefined;
      const accountLogin = accountData ? String(accountData.login ?? installation.accountLogin) : installation.accountLogin;
      const accountType = accountData ? String(accountData.type ?? installation.accountType) : installation.accountType;

      await db.execute(`
        UPDATE github_installations
        SET status = 'active', account_login = ?, account_type = ?, updated_at = ?
        WHERE installation_id = ?
      `, [accountLogin, accountType, now, installationId]);

      const userId = await getWorkspaceUserId(installation.workspaceId);
      if (userId) {
        await db.execute(`
          INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?)
        `, [
          `act_${crypto.randomBytes(10).toString('hex')}`,
          userId,
          'github.installation.connected',
          'GitHub Installation Connected',
          `Connected GitHub App installation for account ${accountLogin}.`,
          now,
        ]);
      }

      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    if (action === 'deleted') {
      const installation = await getGitHubInstallationByInstallationId(installationId, { includeInactive: true });
      if (installation) {
        await updateGitHubInstallationStatus(installationId, 'deleted');

        // Disconnect connected repositories under this workspace
        await db.execute(`
          UPDATE repositories
          SET status = 'disconnected'
          WHERE workspace_id = ? AND status = 'connected'
        `, [installation.workspaceId]);

        const userId = await getWorkspaceUserId(installation.workspaceId);
        if (userId) {
          await db.execute(`
            INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
            VALUES (?, ?, NULL, ?, ?, ?, ?)
          `, [
            `act_${crypto.randomBytes(10).toString('hex')}`,
            userId,
            'github.installation.deleted',
            'GitHub Installation Removed',
            `GitHub App installation was deleted on GitHub for account ${installation.accountLogin}.`,
            now,
          ]);
        }
      }

      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    if (action === 'suspend') {
      await updateGitHubInstallationStatus(installationId, 'suspended');
      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    if (action === 'unsuspend') {
      await updateGitHubInstallationStatus(installationId, 'active');
      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    await recordWebhookDelivery(deliveryId, event, 'ignored', now, `Unhandled action: ${action}`);
    return { received: true, handled: false, reason: `unhandled_action_${action}` };
  }

  // 2. Installation Repositories Events
  if (event === 'installation_repositories') {
    const action = String(payload.action ?? '');
    const instData = payload.installation as Record<string, unknown> | undefined;
    const installationId = instData ? String(instData.id ?? '') : '';

    const installation = await getGitHubInstallationByInstallationId(installationId);
    if (!installation) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Installation not found or inactive');
      return { received: true, handled: false, reason: 'installation_not_found' };
    }

    const userId = await getWorkspaceUserId(installation.workspaceId);

    if (action === 'removed') {
      const removed = (payload.repositories_removed as Array<Record<string, unknown>>) || [];
      for (const repo of removed) {
        const ghRepoId = String(repo.id ?? '');
        if (!ghRepoId) continue;

        // Mark repository unavailable in APIProof (preserve all history)
        const localRepo = await db.queryOne<{ id: string; name: string }>(`
          SELECT id, name FROM repositories
          WHERE workspace_id = ? AND github_repository_id = ? AND lifecycle = 'active'
        `, [installation.workspaceId, ghRepoId]);

        if (localRepo) {
          await db.execute(`
            UPDATE repositories SET status = 'unavailable', lifecycle = 'disconnected' WHERE id = ?
          `, [localRepo.id]);

          if (userId) {
            await db.execute(`
              INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              `act_${crypto.randomBytes(10).toString('hex')}`,
              userId,
              localRepo.id,
              'github.repository.removed',
              'Repository Access Removed',
              `Access to repository ${String(repo.full_name ?? localRepo.name)} was removed from GitHub App.`,
              now,
            ]);
          }
        }
      }

      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    if (action === 'added') {
      const added = (payload.repositories_added as Array<Record<string, unknown>>) || [];
      // Repositories are now accessible in GitHub picker, log activity
      if (added.length > 0 && userId) {
        await db.execute(`
          INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?)
        `, [
          `act_${crypto.randomBytes(10).toString('hex')}`,
          userId,
          'github.repository.added',
          'Repository Access Granted',
          `${added.length} repository/repositories added to GitHub App installation.`,
          now,
        ]);
      }

      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, deliveryId };
    }

    await recordWebhookDelivery(deliveryId, event, 'ignored', now, `Unhandled action: ${action}`);
    return { received: true, handled: false, reason: `unhandled_action_${action}` };
  }

  // 2b. Pull request lifecycle synchronization. The installation and numeric
  // repository identity must both match the same workspace before a PR row can
  // be updated. Unknown PRs are acknowledged and retained as ignored events.
  if (event === 'pull_request') {
    const action = String(payload.action ?? '');
    const supportedActions = new Set([
      'opened', 'converted_to_draft', 'ready_for_review', 'closed', 'reopened', 'synchronize',
    ]);
    if (!supportedActions.has(action)) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, `Unhandled pull_request action: ${action}`);
      return { received: true, handled: false, reason: `unhandled_action_${action}` };
    }

    const installationData = payload.installation as Record<string, unknown> | undefined;
    const repositoryData = payload.repository as Record<string, unknown> | undefined;
    const pullRequestData = payload.pull_request as Record<string, unknown> | undefined;
    const installationId = installationData?.id == null ? '' : String(installationData.id);
    const githubRepositoryId = repositoryData?.id == null ? '' : String(repositoryData.id);
    const number = Number(pullRequestData?.number);
    const prState = String(pullRequestData?.state ?? '');
    const isDraft = pullRequestData?.draft === true;

    if (!installationId || !githubRepositoryId || !Number.isSafeInteger(number) || number <= 0) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Missing installation, repository, or pull request identity');
      return { received: true, handled: false, reason: 'missing_pull_request_identity' };
    }

    const installation = await getGitHubInstallationByInstallationId(installationId);
    if (!installation) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Installation not found or inactive');
      return { received: true, handled: false, reason: 'installation_not_found' };
    }

    const repository = await db.queryOne<{ id: string; workspace_id: string }>(`
      SELECT id, workspace_id FROM repositories
      WHERE github_repository_id = ? AND workspace_id = ? AND lifecycle = 'active'
    `, [githubRepositoryId, installation.workspaceId]);
    if (!repository) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Repository does not belong to the installation workspace');
      return { received: true, handled: false, reason: 'repository_not_in_installation_workspace' };
    }

    let state: 'draft' | 'open' | 'closed' | 'merged';
    if (prState === 'closed') state = pullRequestData?.merged === true ? 'merged' : 'closed';
    else if (prState === 'open') state = isDraft ? 'draft' : 'open';
    else {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Pull request state is not authoritative');
      return { received: true, handled: false, reason: 'invalid_pull_request_state' };
    }

    const result = await db.execute(`
      UPDATE pull_requests
      SET state = ?
      WHERE repository_id = ? AND number = ?
        AND EXISTS (
          SELECT 1 FROM repositories r
          JOIN github_installations gi ON gi.workspace_id = r.workspace_id
          WHERE r.id = pull_requests.repository_id
            AND r.workspace_id = ?
            AND r.github_repository_id = ?
            AND r.lifecycle = 'active'
            AND gi.installation_id = ?
            AND (gi.status IS NULL OR gi.status = 'active')
        )
    `, [state, repository.id, number, installation.workspaceId, githubRepositoryId, installationId]);

    if (result.changes === 0) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Pull request is not mapped to a local proposal');
      return { received: true, handled: false, reason: 'unmapped_pull_request' };
    }

    await recordWebhookDelivery(deliveryId, event, 'processed', now);
    return { received: true, handled: true, deliveryId, status: state };
  }

  // 3. Push Events
  if (event === 'push') {
    // A. Check if push deleted the ref
    const isDeleted = Boolean(payload.deleted) || payload.after === '0000000000000000000000000000000000000000';
    if (isDeleted) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Deleted branch ref ignored');
      return { received: true, handled: false, reason: 'ref_deleted' };
    }

    // B. Check repository ID
    const repoData = payload.repository as Record<string, unknown> | undefined;
    const ghRepoId = repoData ? String(repoData.id ?? '') : '';
    if (!ghRepoId) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Missing repository ID');
      return { received: true, handled: false, reason: 'missing_repository_id' };
    }

    // C. Authoritative match: must be connected to APIProof under an active GitHub installation
    const founderOnly = isLiveScanProtectionEnabled();
    const founderUserId = getConfiguredFounderUserId();
    if (founderOnly && !founderUserId) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Live founder scan authorization is not configured');
      return { received: true, handled: false, reason: 'founder_scan_not_configured' };
    }

    const repo = await db.queryOne<{
      id: string;
      workspace_id: string;
      default_branch: string;
      status: string;
      full_name: string;
    }>(founderOnly ? `
      SELECT r.id, r.workspace_id, r.default_branch, r.status, r.full_name
      FROM repositories r
      JOIN github_installations gi ON gi.workspace_id = r.workspace_id
      JOIN workspace_members owner_member
        ON owner_member.workspace_id = r.workspace_id
       AND owner_member.role = 'owner'
       AND owner_member.user_id = ?
      WHERE r.github_repository_id = ?
        AND r.status = 'connected'
        AND r.lifecycle = 'active'
        AND (gi.status IS NULL OR gi.status = 'active')
      LIMIT 1
    ` : `
      SELECT r.id, r.workspace_id, r.default_branch, r.status, r.full_name
      FROM repositories r
      JOIN github_installations gi ON gi.workspace_id = r.workspace_id
      WHERE r.github_repository_id = ?
        AND r.status = 'connected'
        AND r.lifecycle = 'active'
        AND (gi.status IS NULL OR gi.status = 'active')
      LIMIT 1
    `, founderOnly ? [founderUserId, ghRepoId] : [ghRepoId]);

    if (!repo) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Repository not connected or installation inactive');
      return { received: true, handled: false, reason: 'unmatched_repository' };
    }

    // D. Push Filtering: Only trigger automatic monitoring scan for default branch
    const ref = String(payload.ref ?? '');
    const branchName = ref.startsWith('refs/heads/') ? ref.replace('refs/heads/', '') : ref;
    if (branchName !== repo.default_branch) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, `Non-default branch push ignored: ${branchName}`);
      return { received: true, handled: false, reason: 'non_default_branch' };
    }

    // E. Commit SHA
    const commitSha = String(payload.after ?? '');
    if (!commitSha) {
      await recordWebhookDelivery(deliveryId, event, 'ignored', now, 'Missing commit SHA');
      return { received: true, handled: false, reason: 'missing_commit_sha' };
    }

    // F. Scan Request Idempotency: Check if scan request already exists for (repository_id, commit_sha)
    const existingReq = await db.queryOne<{ id: string }>(`
      SELECT id FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?
    `, [repo.id, commitSha]);

    if (existingReq) {
      await recordWebhookDelivery(deliveryId, event, 'processed', now);
      return { received: true, handled: true, replayed: true, scanRequestId: existingReq.id };
    }

    // G. Create durable scan request record
    const scanRequestId = `req_${crypto.randomBytes(12).toString('hex')}`;
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [scanRequestId, repo.workspace_id, repo.id, commitSha, ref, deliveryId, now]);

    // H. Also create durable pending scan row in scans table
    const scanId = `scn_${crypto.randomBytes(12).toString('hex')}`;
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES (?, ?, ?, 'pending', 'multi-provider', ?)
    `, [scanId, repo.id, commitSha, now]);

    // I. Record activity event
    const userId = await getWorkspaceUserId(repo.workspace_id);
    if (userId) {
      await db.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        userId,
        repo.id,
        'github.scan.requested',
        'Scan Requested',
        `Automated scan requested for ${repo.full_name} at commit ${commitSha.slice(0, 7)}.`,
        now,
      ]);
    }

    await recordWebhookDelivery(deliveryId, event, 'processed', now);
    return {
      received: true,
      handled: true,
      scanRequestId,
      status: 'pending',
    };
  }

  // 4. Unsupported events receive successful acknowledgement
  await recordWebhookDelivery(deliveryId, event, 'ignored', now, `Unsupported event: ${event}`);
  return { received: true, handled: false, reason: 'unsupported_event' };
}
