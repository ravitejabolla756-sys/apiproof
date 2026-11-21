import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { enqueueProviderChangeSlackNotifications, processOneSlackProviderChangeDelivery } from '../apps/web/src/lib/server/slack-provider-change-notifications.js';
import { cleanupSlackTest, initializeSlackTest, mockSlackSuccess, slackFixture, timestamp } from './slack-test-fixtures.js';
import { refreshProviderChangelog } from '../apps/web/src/lib/server/provider-change-monitor.js';

const TEST_DB_PATH = path.resolve('.tmp/test-slack-provider-change.db');

describe('Slack provider-change notifications', () => {
  beforeEach(() => initializeSlackTest(TEST_DB_PATH));
  afterEach(async () => {
    await cleanupSlackTest(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('enqueues one workspace-scoped delivery and sends a review-only alert', async () => {
    const fixture = await slackFixture('provider-change');
    const db = getDatabase();
    const now = timestamp();
    const scan = await db.queryOne<{ id: string }>('SELECT id FROM scans WHERE repository_id = ?', [fixture.repoId]);
    await db.execute(`INSERT INTO repository_provider_usage
      (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at)
      VALUES (?, ?, 'openai', ?, ?, ?, ?)`, [fixture.repoId, fixture.workspaceId, scan!.id, now, now, now]);
    const sourceId = 'pcs_slack_provider_change';
    const entryId = 'pce_slack_provider_change';
    await db.execute(`INSERT INTO provider_change_sources
      (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at)
      VALUES (?, 'openai', 'https://developers.openai.com/api/docs/deprecations', 'deprecation-notice', 'openai', ?, ?)`, [sourceId, now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries
      (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at)
      VALUES (?, ?, 'openai', 'slack-change', 'Model retirement detected', 'The official model deprecation source changed.', 'test', 'https://developers.openai.com/api/docs/deprecations', ?, '{}', ?, ?)`, [entryId, sourceId, 'a'.repeat(64), now, now]);

    expect(await enqueueProviderChangeSlackNotifications([entryId, entryId])).toBe(1);
    expect(await enqueueProviderChangeSlackNotifications([entryId])).toBe(0);
    expect(await db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_provider_change_deliveries')).toEqual({ count: 1 });

    const slack = mockSlackSuccess();
    await expect(processOneSlackProviderChangeDelivery('provider-change-worker')).resolves.toBe(true);
    expect(await db.queryOne<{ status: string }>('SELECT status FROM slack_provider_change_deliveries WHERE changelog_entry_id = ?', [entryId])).toEqual({ status: 'delivered' });
    const post = slack.calls.find((call) => call.url.endsWith('/chat.postMessage'));
    expect(post?.body.text).toContain('no production rule was activated');
    expect(JSON.stringify(post?.body)).not.toContain('xoxb-test-only');
  });

  it('is created by the changelog monitor only after a source changes', async () => {
    const fixture = await slackFixture('provider-change-monitor');
    const db = getDatabase();
    const now = new Date('2027-01-01T00:00:00.000Z');
    const scan = await db.queryOne<{ id: string }>('SELECT id FROM scans WHERE repository_id = ?', [fixture.repoId]);
    await db.execute(`INSERT INTO repository_provider_usage
      (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at)
      VALUES (?, ?, 'openai', ?, ?, ?, ?)`, [fixture.repoId, fixture.workspaceId, scan!.id, now.toISOString(), now.toISOString(), now.toISOString()]);
    let body = '<p>OpenAI baseline</p>';
    const options = {
      fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
      resolveHost: async () => [{ address: '93.184.216.34' }],
      now: () => now,
    };
    await refreshProviderChangelog('openai', options);
    expect(await db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_provider_change_deliveries')).toEqual({ count: 0 });
    body = '<p>2027-01-01 breaking change: <code>gpt-4-legacy</code> is removed</p>';
    await refreshProviderChangelog('openai', options);
    expect(await db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_provider_change_deliveries')).toEqual({ count: 1 });
  });

  it('marks exhausted provider-change deliveries terminal without calling Slack', async () => {
    const fixture = await slackFixture('provider-change-exhausted');
    const db = getDatabase();
    const now = timestamp();
    const scan = await db.queryOne<{ id: string }>('SELECT id FROM scans WHERE repository_id = ?', [fixture.repoId]);
    await db.execute(`INSERT INTO repository_provider_usage
      (repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at)
      VALUES (?, ?, 'openai', ?, ?, ?, ?)`, [fixture.repoId, fixture.workspaceId, scan!.id, now, now, now]);
    await db.execute(`INSERT INTO provider_change_sources
      (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at)
      VALUES (?, 'openai', 'https://developers.openai.com/api/docs/deprecations', 'deprecation-notice', 'openai', ?, ?)`, ['pcs_exhausted', now, now]);
    await db.execute(`INSERT INTO provider_changelog_entries
      (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at)
      VALUES (?, 'pcs_exhausted', 'openai', 'exhausted', 'Exhausted change', 'Review-only change.', 'test', 'https://developers.openai.com/api/docs/deprecations', ?, '{}', ?, ?)`, ['pce_exhausted', 'b'.repeat(64), now, now]);
    await enqueueProviderChangeSlackNotifications(['pce_exhausted']);
    await db.execute("UPDATE slack_provider_change_deliveries SET attempt_count = 5 WHERE changelog_entry_id = 'pce_exhausted'");

    const slack = mockSlackSuccess();
    await expect(processOneSlackProviderChangeDelivery('provider-change-worker')).resolves.toBe(false);
    expect(slack.calls).toHaveLength(0);
    expect(await db.queryOne<{ status: string; error_category: string }>("SELECT status, error_category FROM slack_provider_change_deliveries WHERE changelog_entry_id = 'pce_exhausted'"))
      .toEqual({ status: 'failed', error_category: 'SLACK_ATTEMPTS_EXHAUSTED' });
  });
});
