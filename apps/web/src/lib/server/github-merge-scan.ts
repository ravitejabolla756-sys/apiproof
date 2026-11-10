import crypto from 'node:crypto';
import type { DatabaseAdapter } from './db/types.js';

export async function enqueueMergedPullRequestScan(
  db: DatabaseAdapter,
  params: {
    deliveryId: string;
    repositoryId: string;
    workspaceId: string;
    defaultBranch: string;
    commitSha: string;
    now: string;
  },
): Promise<string> {
  const ref = `refs/heads/${params.defaultBranch}`;
  const existing = await db.queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?',
    [params.repositoryId, params.commitSha],
  );
  const scanRequestId = existing?.id ?? `req_${crypto.randomBytes(12).toString('hex')}`;

  if (!existing) {
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT (repository_id, commit_sha) DO NOTHING
    `, [scanRequestId, params.workspaceId, params.repositoryId, params.commitSha, ref, params.deliveryId, params.now]);
  }

  const request = await db.queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?',
    [params.repositoryId, params.commitSha],
  );
  if (!request) throw new Error('MERGED_SCAN_QUEUE_FAILED');
  if (request.status === 'failed' || (request.status === 'completed' && !await db.queryOne<{ id: string }>(
    "SELECT id FROM scans WHERE repository_id = ? AND sha = ? AND status = 'completed' AND triggered_by = 'pull_request_merge' LIMIT 1",
    [params.repositoryId, params.commitSha],
  ))) {
    await db.execute(`
      UPDATE github_scan_requests
      SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL,
          last_error_category = NULL, last_error_message = NULL
      WHERE id = ? AND status = 'failed'
    `, [request.id]);
  }

  const scan = await db.queryOne<{ id: string; status: string; triggered_by: string | null }>(
    'SELECT id, status, triggered_by FROM scans WHERE repository_id = ? AND sha = ? ORDER BY started_at DESC LIMIT 1',
    [params.repositoryId, params.commitSha],
  );
  if (scan) {
    if (scan.status === 'failed' || (scan.status === 'completed' && scan.triggered_by !== 'pull_request_merge')) {
      await db.execute(`
        UPDATE scans
        SET status = 'pending', error_message = NULL, triggered_by = ?, triggered_at = ?, started_at = ?
        WHERE id = ? AND (status = 'failed' OR (status = 'completed' AND triggered_by <> 'pull_request_merge'))
      `, ['pull_request_merge', params.now, params.now, scan.id]);
    } else if (scan.triggered_by !== 'pull_request_merge') {
      await db.execute(`
        UPDATE scans SET triggered_by = ?, triggered_at = ?
        WHERE id = ? AND status IN ('pending', 'running')
      `, ['pull_request_merge', params.now, scan.id]);
    }
  } else {
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, triggered_by, triggered_at, started_at)
      VALUES (?, ?, ?, 'pending', 'multi-provider', 'pull_request_merge', ?, ?)
    `, [`scn_${crypto.randomBytes(12).toString('hex')}`, params.repositoryId, params.commitSha, params.now, params.now]);
  }
  return request.id;
}

