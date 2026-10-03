import crypto from 'node:crypto';
import { formatCanonicalMigrationBranch, requireAuthoritativeDefaultBranch } from '@apiproof/core';
import { getDatabase } from './db/index.js';
import { readBoundMigrationProof } from './migration-proof.js';
import type { SlackFindingBinding } from './slack-authorization.js';
import { logger } from './logger.js';

type Outcome = 'draft_pr_created' | 'verification_failed' | 'execution_unavailable';
interface OutcomeBinding extends SlackFindingBinding { migration_id: string | null }

function eventKey(row: OutcomeBinding, outcome: Outcome, interactionId: string): string {
  return row.migration_id ? `${row.workspace_id}:${row.migration_id}:proposal:${outcome}`
    : `${row.workspace_id}:interaction:${interactionId}:${outcome}`;
}

async function enqueueOutcome(row: OutcomeBinding, outcome: Outcome, interactionId: string): Promise<void> {
  const now = new Date().toISOString();
  // Completion is an intent to reconcile, not proof that a PR exists. The sender resolves the PR/evidence afresh.
  await getDatabase().execute(`INSERT INTO slack_notification_deliveries
    (id, event_key, workspace_id, repository_id, finding_id, migration_id, slack_connection_id,
     event_type, result_state, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'proposal_result', ?, 'pending', ?, ?) ON CONFLICT(event_key) DO NOTHING`,
  [`sld_${crypto.randomBytes(12).toString('hex')}`, eventKey(row, outcome, interactionId), row.workspace_id,
    row.repository_id, row.finding_id, row.migration_id, row.slack_connection_id,
    outcome === 'draft_pr_created' ? 'proposal_reconciliation_pending' : outcome, now, now]);
}

function validateUrlInput(url?: string): void {
  if (url && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/.test(url)) throw new Error('SLACK_PROPOSAL_URL_INVALID');
}

export async function queueSlackProposalOutcome(input: { migrationId: string; outcome: Outcome; proposalUrl?: string }): Promise<void> {
  validateUrlInput(input.proposalUrl);
  const linked = await getDatabase().query<OutcomeBinding & { id: string }>(`
    SELECT ij.id, ij.workspace_id, ij.repository_id, ij.finding_id, ij.migration_id, ij.slack_connection_id
    FROM slack_interaction_jobs ij JOIN slack_connections sc ON sc.id = ij.slack_connection_id
      AND sc.workspace_id = ij.workspace_id AND sc.status = 'active'
    JOIN migrations m ON m.id = ij.migration_id AND m.repository_id = ij.repository_id AND m.finding_id = ij.finding_id
    JOIN findings f ON f.id = ij.finding_id AND f.repository_id = ij.repository_id
    JOIN repositories r ON r.id = ij.repository_id AND r.workspace_id = ij.workspace_id
    WHERE ij.migration_id = ? AND ij.action = 'create_pr' AND ij.status IN ('processing', 'completed')
  `, [input.migrationId]);
  for (const row of linked) await enqueueOutcome(row, input.outcome, row.id);
}

export async function queueSlackInteractionOutcome(interactionJobId: string, outcome: Outcome, proposalUrl?: string): Promise<void> {
  validateUrlInput(proposalUrl);
  const row = await getDatabase().queryOne<OutcomeBinding>(`
    SELECT ij.workspace_id, ij.repository_id, ij.finding_id, ij.migration_id, ij.slack_connection_id
    FROM slack_interaction_jobs ij JOIN slack_connections sc ON sc.id = ij.slack_connection_id
      AND sc.workspace_id = ij.workspace_id AND sc.status = 'active'
    JOIN findings f ON f.id = ij.finding_id AND f.repository_id = ij.repository_id
    JOIN repositories r ON r.id = ij.repository_id AND r.workspace_id = ij.workspace_id
    WHERE ij.id = ? AND ij.status IN ('completed', 'failed')
  `, [interactionJobId]);
  if (row) await enqueueOutcome(row, outcome, interactionJobId);
}

/** Terminal DB jobs ARE the durable outcome facts. Recover missing outbox rows after any enqueue/crash window.
 * No Slack I/O, no GitHub writes, and no dependency on a transient result_json URL.
 */
export async function reconcileSlackTerminalOutcomes(): Promise<void> {
  const rows = await getDatabase().query<OutcomeBinding & { id: string; outcome: Outcome }>(`
    SELECT * FROM (
      SELECT ij.id, ij.workspace_id, ij.repository_id, ij.finding_id, ij.migration_id, ij.slack_connection_id,
        CASE WHEN vj.status = 'completed' OR ij.error_category = 'SLACK_PROPOSAL_COMPLETED' THEN 'draft_pr_created'
          WHEN vj.status = 'execution_unavailable' OR ij.error_category = 'VERIFICATION_EXECUTION_UNAVAILABLE' THEN 'execution_unavailable'
          WHEN vj.status = 'failed' OR ij.status = 'failed' THEN 'verification_failed' END AS outcome
      FROM slack_interaction_jobs ij JOIN slack_connections sc ON sc.id = ij.slack_connection_id
        AND sc.workspace_id = ij.workspace_id AND sc.status = 'active'
      JOIN findings f ON f.id = ij.finding_id AND f.repository_id = ij.repository_id
      JOIN repositories r ON r.id = ij.repository_id AND r.workspace_id = ij.workspace_id
      LEFT JOIN migration_verification_jobs vj ON vj.migration_id = ij.migration_id
        AND vj.workspace_id = ij.workspace_id AND vj.repository_id = ij.repository_id
      WHERE ij.action = 'create_pr' AND ij.status IN ('processing', 'completed', 'failed')
    ) terminal WHERE outcome IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM slack_notification_deliveries d WHERE d.event_key =
        CASE WHEN terminal.migration_id IS NOT NULL THEN terminal.workspace_id || ':' || terminal.migration_id || ':proposal:' || terminal.outcome
          ELSE terminal.workspace_id || ':interaction:' || terminal.id || ':' || terminal.outcome END
    ) LIMIT 25
  `);
  for (const row of rows) await enqueueOutcome(row, row.outcome, row.id);
}

export async function safelyReconcileSlackTerminalOutcomes(): Promise<void> {
  try { await reconcileSlackTerminalOutcomes(); }
  catch { logger.warn('slack_terminal_outcome_reconciliation_deferred', { category: 'SLACK_OUTBOX_DATABASE_UNAVAILABLE' }); }
}

/** Only the persisted, bound proposal service output may authorize success wording/links. */
export async function requireAuthoritativeSlackDraftPr(binding: OutcomeBinding): Promise<string> {
  const row = await getDatabase().queryOne<{
    number: number; url: string; state: string; branch_name: string; base_branch: string;
    status: string; baseline_sha: string | null; patch_digest: string | null; verification_report: string | null;
    change_id: string; github_repository_id: string; default_branch: string; owner: string; name: string;
    sha: string; scan_status: string; job_baseline: string | null;
  }>(`
    SELECT pr.number, pr.url, pr.state, pr.branch_name, pr.base_branch, m.status, m.baseline_sha, m.patch_digest,
      m.verification_report, f.change_id, r.github_repository_id, r.default_branch, r.owner, r.name,
      s.sha, s.status AS scan_status, vj.baseline_sha AS job_baseline
    FROM pull_requests pr JOIN migrations m ON m.id = pr.migration_id AND m.repository_id = pr.repository_id
    JOIN findings f ON f.id = m.finding_id AND f.repository_id = m.repository_id
    JOIN repositories r ON r.id = m.repository_id AND r.lifecycle = 'active'
    JOIN scans s ON s.id = f.scan_id AND s.repository_id = r.id
    LEFT JOIN migration_verification_jobs vj ON vj.migration_id = m.id AND vj.repository_id = r.id AND vj.workspace_id = r.workspace_id
    WHERE m.id = ? AND m.finding_id = ? AND r.id = ? AND r.workspace_id = ?
  `, [binding.migration_id, binding.finding_id, binding.repository_id, binding.workspace_id]);
  try {
    if (!row || !binding.migration_id || row.state !== 'draft' || row.status !== 'pr_created'
      || !Number.isSafeInteger(row.number) || row.number <= 0 || row.scan_status !== 'completed'
      || row.baseline_sha !== row.sha || (row.job_baseline && row.job_baseline !== row.sha)
      || !row.patch_digest || !/^[a-f0-9]{40}$/i.test(row.sha)
      || row.branch_name !== formatCanonicalMigrationBranch(row.change_id, binding.migration_id)
      || row.base_branch !== requireAuthoritativeDefaultBranch(row.default_branch)
      || row.url !== `https://github.com/${row.owner}/${row.name}/pull/${row.number}`) throw new Error('Invalid proposal');
    readBoundMigrationProof(row.verification_report, {
      repositoryId: row.github_repository_id, baselineSha: row.sha, changeId: row.change_id, patchDigest: row.patch_digest,
    });
    return row.url;
  } catch { throw new Error('SLACK_PROPOSAL_RECONCILIATION_REQUIRED'); }
}
