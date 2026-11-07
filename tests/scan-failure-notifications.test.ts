import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { markScanWorkerJobFailed } from '../apps/web/src/lib/server/scan-worker-state.js';
import { enqueueScanFailureNotification, processOneSlackScanFailureDelivery } from '../apps/web/src/lib/server/slack-scan-failure-notifications.js';
import { updateNotificationPreferences } from '../apps/web/src/lib/server/notification-preferences-service.js';
import { cleanupSlackTest, initializeSlackTest, mockSlackSuccess, slackFixture, timestamp } from './slack-test-fixtures.js';

const TEST_DB_PATH = path.resolve('.tmp/test-scan-failure-notifications.db');

describe('Slack scan-failure notifications', () => {
  beforeEach(() => initializeSlackTest(TEST_DB_PATH));
  afterEach(async () => {
    await cleanupSlackTest(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  async function failedScan(fixture: Awaited<ReturnType<typeof slackFixture>>, status = 'failed', suffix = status) {
    const db = getDatabase();
    const id = `scan_request_${fixture.repoId}_${status}_${suffix}`;
    const now = timestamp();
    await db.execute(`INSERT INTO github_scan_requests
      (id, workspace_id, repository_id, commit_sha, ref, status, created_at, last_error_category, last_error_message)
      VALUES (?, ?, ?, ?, 'refs/heads/main', ?, ?, 'GITHUB_NETWORK', 'private source detail must not be sent')`,
    [id, fixture.workspaceId, fixture.repoId, status === 'failed' ? 'b'.repeat(40) : `${suffix.slice(0, 1).padEnd(1, 'c')}${'c'.repeat(39)}`, status, now]);
    return id;
  }

  it('enqueues terminal failures once and stays silent for transient retries', async () => {
    const fixture = await slackFixture('scan-failure-terminal');
    const terminalId = await failedScan(fixture);
    expect(await enqueueScanFailureNotification(terminalId)).toBe(1);
    expect(await enqueueScanFailureNotification(terminalId)).toBe(0);

    const retryId = await failedScan(fixture, 'pending');
    expect(await enqueueScanFailureNotification(retryId)).toBe(0);
    expect(await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_scan_failure_deliveries')).toEqual({ count: 1 });
  });

  it('creates the event from the scan worker terminal transition and honors opt-out before enqueue', async () => {
    const fixture = await slackFixture('scan-failure-hook');
    await updateNotificationPreferences(fixture.userId, [{ category: 'scan_failure', channel: 'slack', enabled: false }]);
    const scanRequestId = await failedScan(fixture, 'processing');
    await markScanWorkerJobFailed(getDatabase(), {
      id: scanRequestId,
      repository_id: fixture.repoId,
      commit_sha: 'c'.repeat(40),
      attempt_count: 3,
    }, 'SOURCE_FETCH_FAILED', 'private source detail');
    expect(await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_scan_failure_deliveries')).toEqual({ count: 0 });

    await updateNotificationPreferences(fixture.userId, [{ category: 'scan_failure', channel: 'slack', enabled: true }]);
    const enabledScanRequestId = await failedScan(fixture, 'processing', 'enabled');
    await markScanWorkerJobFailed(getDatabase(), {
      id: enabledScanRequestId,
      repository_id: fixture.repoId,
      commit_sha: 'd'.repeat(40),
      attempt_count: 3,
    }, 'SOURCE_FETCH_FAILED', 'private source detail');
    expect(await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM slack_scan_failure_deliveries')).toEqual({ count: 1 });
  });

  it('delivers only safe repository context and a dashboard link', async () => {
    const fixture = await slackFixture('scan-failure-delivery');
    const scanRequestId = await failedScan(fixture);
    await enqueueScanFailureNotification(scanRequestId);
    const slack = mockSlackSuccess();
    await expect(processOneSlackScanFailureDelivery('scan-failure-worker')).resolves.toBe(true);
    expect(await getDatabase().queryOne<{ status: string }>('SELECT status FROM slack_scan_failure_deliveries WHERE scan_request_id = ?', [scanRequestId])).toEqual({ status: 'delivered' });
    const post = slack.calls.find((call) => call.url.endsWith('/chat.postMessage'));
    expect(post?.body.text).toContain('acme/scan-failure-delivery');
    expect(post?.body.text).toContain('GITHUB_NETWORK');
    expect(JSON.stringify(post?.body)).toContain('https://myowl.example.test/dashboard/repositories/');
    expect(JSON.stringify(post?.body)).not.toContain('private source detail');
    expect(JSON.stringify(post?.body)).not.toContain('xoxb-test-only');
  });

  it('suppresses a queued delivery when the preference changes before provider I/O', async () => {
    const fixture = await slackFixture('scan-failure-queued-opt-out');
    const scanRequestId = await failedScan(fixture);
    await enqueueScanFailureNotification(scanRequestId);
    await updateNotificationPreferences(fixture.userId, [{ category: 'scan_failure', channel: 'slack', enabled: false }]);
    const slack = mockSlackSuccess();
    await expect(processOneSlackScanFailureDelivery('scan-failure-worker')).resolves.toBe(true);
    expect(await getDatabase().queryOne<{ status: string; error_category: string }>('SELECT status, error_category FROM slack_scan_failure_deliveries WHERE scan_request_id = ?', [scanRequestId])).toEqual({ status: 'failed', error_category: 'SLACK_NOTIFICATION_SUPPRESSED' });
    expect(slack.calls).toHaveLength(0);
  });

  it('records an uncertain provider failure without persisting provider response content', async () => {
    const fixture = await slackFixture('scan-failure-provider-error');
    const scanRequestId = await failedScan(fixture);
    await enqueueScanFailureNotification(scanRequestId);
    const fetchMock = vi.fn(async () => new Response('provider-internal-secret', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(processOneSlackScanFailureDelivery('scan-failure-worker')).resolves.toBe(true);
    const delivery = await getDatabase().queryOne<{ status: string; error_category: string; error_message?: string }>(
      'SELECT status, error_category FROM slack_scan_failure_deliveries WHERE scan_request_id = ?', [scanRequestId],
    );
    expect(delivery).toEqual({ status: 'failed', error_category: 'SLACK_DELIVERY_UNCERTAIN' });
    expect(JSON.stringify(delivery)).not.toContain('provider-internal-secret');
  });
});
