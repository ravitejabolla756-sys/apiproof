import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { processOneMigrationVerificationJob } from '../apps/web/src/lib/server/migration-verification-worker.js';
import { processOneSlackNotificationDelivery } from '../apps/web/src/lib/server/slack-notifications.js';
import { queueSlackInteractionOutcome, queueSlackProposalOutcome, reconcileSlackTerminalOutcomes, requireAuthoritativeSlackDraftPr } from '../apps/web/src/lib/server/slack-outcomes.js';
import { initializeSlackTest, cleanupSlackTest, linkedSlackMigration, mockSlackSuccess, timestamp } from './slack-test-fixtures.js';

const dbPath = path.resolve('.tmp/test-slack-outcomes.db');
beforeEach(() => initializeSlackTest(dbPath));
afterEach(() => cleanupSlackTest(dbPath));

async function terminalJob(fixture: Awaited<ReturnType<typeof linkedSlackMigration>>, status = 'completed') {
  await getDatabase().execute(`INSERT INTO migration_verification_jobs
    (id, migration_id, workspace_id, repository_id, requested_by, baseline_sha, status, result_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [`vjob_${fixture.migrationId}`, fixture.migrationId, fixture.workspaceId,
    fixture.repoId, fixture.userId, fixture.baselineSha, status, JSON.stringify({ status: 'completed', url: 'https://github.com/attacker/unrelated/pull/99' }), timestamp(), timestamp()]);
}

describe('Durable authoritative Slack proposal outcomes', () => {
  it('recovers a DB enqueue failure AFTER terminal proposal persistence without failing or replaying the proposal', async () => {
    const fixture = await linkedSlackMigration(true);
    const db = getDatabase();
    await terminalJob(fixture, 'pending');
    const execute = db.execute.bind(db);
    const fault = vi.spyOn(db, 'execute').mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO slack_notification_deliveries')) throw new Error('outbox database interruption');
      return execute(sql, params);
    });
    expect(await processOneMigrationVerificationJob('proof-worker')).toBe(true);
    expect(await db.queryOne('SELECT status FROM migration_verification_jobs WHERE migration_id = ?', [fixture.migrationId])).toEqual({ status: 'completed' });
    expect(await db.queryOne('SELECT status FROM migrations WHERE id = ?', [fixture.migrationId])).toEqual({ status: 'pr_created' });
    expect(await db.queryOne('SELECT id FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toBeUndefined();
    fault.mockRestore();
    await reconcileSlackTerminalOutcomes(); // The same entry point is run on the worker's next/restarted iteration.
    await reconcileSlackTerminalOutcomes();
    expect(await db.queryOne('SELECT COUNT(*) AS count FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ count: 1 });
    const { calls } = mockSlackSuccess();
    await processOneSlackNotificationDelivery('notification-worker');
    expect(JSON.stringify(calls[1]?.body)).toContain(fixture.proposal!.url);
    expect(await db.queryOne('SELECT COUNT(*) AS count FROM pull_requests WHERE migration_id = ?', [fixture.migrationId])).toEqual({ count: 1 });
    expect(await processOneMigrationVerificationJob('proof-worker')).toBe(false);
  });

  it.each(['failed', 'execution_unavailable'])('reconciles a durable %s job independently of Slack availability', async (status) => {
    const fixture = await linkedSlackMigration();
    await terminalJob(fixture, status);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await reconcileSlackTerminalOutcomes();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT result_state FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId]))
      .toEqual({ result_state: status === 'failed' ? 'verification_failed' : 'execution_unavailable' });
  });

  it('deduplicates the immediate interaction and worker completion paths into ONE outcome', async () => {
    const fixture = await linkedSlackMigration(true);
    await terminalJob(fixture);
    await queueSlackInteractionOutcome(fixture.interactionId, 'draft_pr_created');
    await queueSlackProposalOutcome({ migrationId: fixture.migrationId, outcome: 'draft_pr_created', proposalUrl: fixture.proposal!.url });
    await reconcileSlackTerminalOutcomes();
    expect(await getDatabase().queryOne('SELECT COUNT(*) AS count FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ count: 1 });
  });

  it('never uses malformed completed result JSON/URL as proof of a PR and leaves missing PR evidence recoverable', async () => {
    const fixture = await linkedSlackMigration();
    await terminalJob(fixture);
    await reconcileSlackTerminalOutcomes();
    const { fetchMock } = mockSlackSuccess();
    await processOneSlackNotificationDelivery('notification-worker');
    expect(fetchMock).not.toHaveBeenCalled();
    const row = (await getDatabase().queryOne<{ status: string; error_category: string; result_state: string; result_url: string | null; next_attempt_at: string }>(
      'SELECT * FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId]))!;
    expect(row).toMatchObject({ status: 'pending', error_category: 'SLACK_PROPOSAL_RECONCILIATION_REQUIRED', result_state: 'proposal_reconciliation_pending', result_url: null });
    expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now());
    expect(await getDatabase().queryOne('SELECT id FROM pull_requests')).toBeUndefined();
    expect(await processOneSlackNotificationDelivery('notification-worker')).toBe(false);
  });

  it('sends success only from the real persisted proposal service output and bound evidence, not result_json', async () => {
    const fixture = await linkedSlackMigration(true);
    await terminalJob(fixture);
    await reconcileSlackTerminalOutcomes();
    expect(await requireAuthoritativeSlackDraftPr(fixture.binding)).toBe(fixture.proposal!.url);
    const { calls } = mockSlackSuccess();
    await processOneSlackNotificationDelivery('notification-worker');
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.text).toBe('Draft PR created.');
    expect(JSON.stringify(calls)).toContain(fixture.proposal!.url);
    expect(JSON.stringify(calls)).not.toContain('attacker');
    expect(await getDatabase().queryOne('SELECT result_state, result_url, status FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId]))
      .toEqual({ result_state: 'draft_pr_created', result_url: fixture.proposal!.url, status: 'delivered' });
  });

  it('does not promote test-only contract proof to production EXECUTION_VERIFIED', async () => {
    const fixture = await linkedSlackMigration(true);
    vi.stubEnv('NODE_ENV', 'production');
    await expect(requireAuthoritativeSlackDraftPr(fixture.binding)).rejects.toThrow('SLACK_PROPOSAL_RECONCILIATION_REQUIRED');
  });

  it.each(['pr-state', 'branch', 'base', 'repository', 'finding', 'workspace', 'baseline', 'digest', 'proof', 'job-baseline'] as const)(
    'rejects %s mismatch without any provider call or success wording', async (kind) => {
      const fixture = await linkedSlackMigration(true);
      await terminalJob(fixture);
      await reconcileSlackTerminalOutcomes();
      const db = getDatabase();
      if (kind === 'pr-state') await db.execute("UPDATE pull_requests SET state = 'open' WHERE migration_id = ?", [fixture.migrationId]);
      if (kind === 'branch') await db.execute("UPDATE pull_requests SET branch_name = 'main' WHERE migration_id = ?", [fixture.migrationId]);
      if (kind === 'base') await db.execute("UPDATE pull_requests SET base_branch = 'arbitrary' WHERE migration_id = ?", [fixture.migrationId]);
      if (kind === 'repository') await db.execute("UPDATE pull_requests SET repository_id = 'repo_apiproof_fixture' WHERE migration_id = ?", [fixture.migrationId]);
      if (kind === 'finding') fixture.binding.finding_id = 'different-finding';
      if (kind === 'workspace') fixture.binding.workspace_id = 'different-workspace';
      if (kind === 'baseline') await db.execute('UPDATE migrations SET baseline_sha = ? WHERE id = ?', ['b'.repeat(40), fixture.migrationId]);
      if (kind === 'digest') await db.execute('UPDATE migrations SET patch_digest = ? WHERE id = ?', ['c'.repeat(64), fixture.migrationId]);
      if (kind === 'proof') await db.execute("UPDATE migrations SET verification_report = '{}' WHERE id = ?", [fixture.migrationId]);
      if (kind === 'job-baseline') await db.execute('UPDATE migration_verification_jobs SET baseline_sha = ? WHERE migration_id = ?', ['b'.repeat(40), fixture.migrationId]);
      await expect(requireAuthoritativeSlackDraftPr(fixture.binding)).rejects.toThrow('SLACK_PROPOSAL_RECONCILIATION_REQUIRED');
      if (kind === 'finding' || kind === 'workspace') {
        // The persisted delivery binding, not only the direct proof helper, must reject a foreign identity.
        await db.execute('UPDATE slack_notification_deliveries SET repository_id = ? WHERE migration_id = ?', ['repo_apiproof_fixture', fixture.migrationId]);
      }
      const { fetchMock } = mockSlackSuccess();
      await processOneSlackNotificationDelivery('notification-worker');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('suppresses a failed-attempt message superseded by a persisted PR', async () => {
    const fixture = await linkedSlackMigration(true);
    await queueSlackProposalOutcome({ migrationId: fixture.migrationId, outcome: 'verification_failed' });
    const { fetchMock } = mockSlackSuccess();
    await processOneSlackNotificationDelivery('notification-worker');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT status, error_category FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId]))
      .toEqual({ status: 'failed', error_category: 'SLACK_OUTCOME_SUPERSEDED' });
  });
});
