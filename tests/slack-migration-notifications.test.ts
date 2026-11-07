import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { processGitHubWebhook } from '../apps/web/src/lib/server/github-webhooks.js';
import { updateNotificationPreferences } from '../apps/web/src/lib/server/notification-preferences-service.js';
import { processOneSlackNotificationDelivery } from '../apps/web/src/lib/server/slack-notifications.js';
import { queueSlackMigrationLifecycleEvent } from '../apps/web/src/lib/server/slack-outcomes.js';
import { cleanupSlackTest, initializeSlackTest, mockSlackSuccess, slackFixture, timestamp } from './slack-test-fixtures.js';

const TEST_DB_PATH = path.resolve('.tmp/test-slack-migration-notifications.db');

describe('Slack migration and PR lifecycle notifications', () => {
  beforeEach(() => initializeSlackTest(TEST_DB_PATH));
  afterEach(async () => {
    await cleanupSlackTest(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  async function migrationFixture(name: string) {
    const fixture = await slackFixture(name);
    const db = getDatabase();
    const now = timestamp();
    const migrationId = `migration_${fixture.repoId}`;
    await db.execute(`INSERT INTO migrations
      (id, finding_id, repository_id, plan_id, status, plan_json, baseline_sha, patch_digest, created_at)
      VALUES (?, ?, ?, ?, 'pr_created', '{}', ?, ?, ?)`,
    [migrationId, fixture.findingId, fixture.repoId, `plan_${migrationId}`, fixture.baselineSha, 'd'.repeat(64), now]);
    await db.execute(`INSERT INTO pull_requests
      (id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at)
      VALUES (?, ?, ?, 7, 'Draft migration', 'apiproof/change', 'main', ?, 'draft', ?)`,
    [`pr_${migrationId}`, migrationId, fixture.repoId, `https://github.com/acme/${name}/pull/7`, now]);
    // The fixture's finding alert is unrelated to this test's lifecycle event.
    await db.execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE event_type = 'breaking_finding'");
    return { ...fixture, migrationId };
  }

  it('deduplicates a merged event and does not claim verified resolution', async () => {
    const fixture = await migrationFixture('migration-merged');
    const db = getDatabase();
    await db.execute("UPDATE pull_requests SET state = 'merged' WHERE migration_id = ?", [fixture.migrationId]);
    expect(await queueSlackMigrationLifecycleEvent({ migrationId: fixture.migrationId, state: 'pr_merged' })).toBe(1);
    expect(await queueSlackMigrationLifecycleEvent({ migrationId: fixture.migrationId, state: 'pr_merged' })).toBe(0);

    const slack = mockSlackSuccess();
    await expect(processOneSlackNotificationDelivery('migration-worker')).resolves.toBe(true);
    const post = slack.calls.find((call) => call.url.endsWith('/chat.postMessage'));
    expect(post?.body.text).toContain('merged');
    expect(JSON.stringify(post?.body)).toContain('https://github.com/acme/migration-merged/pull/7');
    expect(JSON.stringify(post?.body).toLowerCase()).not.toContain('verified resolved');
    expect(await db.queryOne<{ status: string }>('SELECT status FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ status: 'delivered' });
  });

  it('suppresses stale PR-state events and then delivers the authoritative current state', async () => {
    const fixture = await migrationFixture('migration-ordering');
    const db = getDatabase();
    await db.execute("UPDATE pull_requests SET state = 'open' WHERE migration_id = ?", [fixture.migrationId]);
    expect(await queueSlackMigrationLifecycleEvent({ migrationId: fixture.migrationId, state: 'pr_open' })).toBe(1);
    await db.execute("UPDATE pull_requests SET state = 'merged' WHERE migration_id = ?", [fixture.migrationId]);
    const slack = mockSlackSuccess();
    await expect(processOneSlackNotificationDelivery('migration-worker')).resolves.toBe(true);
    expect(slack.calls).toHaveLength(0);
    expect(await db.queryOne<{ status: string; error_category: string }>('SELECT status, error_category FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ status: 'failed', error_category: 'SLACK_PR_STATE_SUPERSEDED' });

    expect(await queueSlackMigrationLifecycleEvent({ migrationId: fixture.migrationId, state: 'pr_merged' })).toBe(1);
    await expect(processOneSlackNotificationDelivery('migration-worker')).resolves.toBe(true);
    expect(slack.calls.some((call) => call.url.endsWith('/chat.postMessage'))).toBe(true);
  });

  it('enqueues proposal validation failures only for opted-in migration recipients', async () => {
    const fixture = await migrationFixture('migration-failure');
    const db = getDatabase();
    await updateNotificationPreferences(fixture.userId, [{ category: 'migration', channel: 'slack', enabled: false }]);
    expect(await queueSlackMigrationLifecycleEvent({ migrationId: fixture.migrationId, state: 'verification_failed' })).toBe(0);
    expect(await db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ count: 0 });
  });

  it('queues the PR lifecycle event from an authorized GitHub webhook update', async () => {
    const fixture = await migrationFixture('migration-webhook');
    const db = getDatabase();
    const repository = await db.queryOne<{ github_repository_id: string }>('SELECT github_repository_id FROM repositories WHERE id = ?', [fixture.repoId]);
    await db.execute(`INSERT INTO github_installations
      (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, 'acme', 'Organization', 'active', ?, ?)`,
    [`installation_${fixture.workspaceId}`, fixture.workspaceId, 'installation-merge-event', timestamp(), timestamp()]);
    const result = await processGitHubWebhook({
      event: 'pull_request',
      deliveryId: 'github-merge-event',
      rawBody: JSON.stringify({
        action: 'closed',
        installation: { id: 'installation-merge-event' },
        repository: { id: Number(repository!.github_repository_id) },
        pull_request: { number: 7, state: 'closed', draft: false, merged: true },
      }),
    });
    expect(result).toMatchObject({ handled: true, status: 'merged' });
    expect(await db.queryOne<{ result_state: string }>('SELECT result_state FROM slack_notification_deliveries WHERE migration_id = ?', [fixture.migrationId])).toEqual({ result_state: 'pr_merged' });
  });
});
