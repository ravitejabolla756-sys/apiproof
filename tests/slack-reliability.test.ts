import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase, SQLITE_SCHEMA, SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { SQLITE_SLACK_SCHEMA } from '../apps/web/src/lib/server/db/slack-migration.js';
import { SQLITE_VERIFICATION_WORKER_SCHEMA } from '../apps/web/src/lib/server/db/verification-worker-migration.js';
import { slackReliabilityMigrations } from '../apps/web/src/lib/server/db/slack-reliability-migration.js';
import { migrations } from '../apps/web/src/lib/server/db/migrator.js';
import { processOneSlackNotificationDelivery } from '../apps/web/src/lib/server/slack-notifications.js';
import { processOneSlackInteractionJob } from '../apps/web/src/lib/server/slack-interactions.js';
import * as proposals from '../apps/web/src/lib/server/proposal-verification-jobs.js';
import { slackRetryAt } from '../apps/web/src/lib/server/slack-retry.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';
import { initializeSlackTest, cleanupSlackTest, slackFixture, linkedSlackMigration, mockSlackSuccess } from './slack-test-fixtures.js';

vi.mock('../apps/web/src/lib/server/verification-worker-registry.js', () => ({ hasReadyVerificationWorker: vi.fn(async () => true) }));
const dbPath = path.resolve('.tmp/test-slack-reliability.db');
beforeEach(() => initializeSlackTest(dbPath));
afterEach(() => cleanupSlackTest(dbPath));

describe('Scheduled Slack retries', () => {
  it('persists exponential backoff with a bound', () => {
    const start = Date.now();
    expect(Date.parse(slackRetryAt(1)) - start).toBeGreaterThanOrEqual(30_000);
    expect(Date.parse(slackRetryAt(2)) - start).toBeGreaterThanOrEqual(60_000);
    expect(Date.parse(slackRetryAt(100)) - start).toBeLessThan(900_100);
  });

  it.each(['network', 'http500'] as const)('schedules a transient %s failure before message send and does not claim it early', async (kind) => {
    const fixture = await slackFixture();
    const fetchMock = vi.fn(async () => {
      if (kind === 'network') throw new TypeError('fetch failed with sensitive provider text');
      return new Response('{}', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await processOneSlackNotificationDelivery('retry-worker');
    const row = (await getDatabase().queryOne<{ status: string; next_attempt_at: string; error_category: string }>('SELECT * FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))!;
    expect(row.status).toBe('pending');
    expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now() + 25_000);
    expect(row.error_category).not.toContain('sensitive');
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['conversations.open', 'chat.postMessage'] as const)('honors Retry-After for %s and blocks other deliveries on that connection', async (method) => {
    const fixture = await slackFixture();
    const fetchMock = vi.fn(async (url: string | URL | Request) => String(url).endsWith(`/${method}`)
      ? new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })
      : new Response(JSON.stringify({ ok: true, channel: { id: 'D123' } })));
    vi.stubGlobal('fetch', fetchMock);
    await processOneSlackNotificationDelivery('retry-worker');
    const row = (await getDatabase().queryOne<{ next_attempt_at: string; post_started_at: string | null }>('SELECT * FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))!;
    expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now() + 115_000);
    expect(row.post_started_at).toBeNull();
    await getDatabase().execute('UPDATE slack_notification_deliveries SET next_attempt_at = NULL WHERE id = ?', [fixture.deliveryId]);
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false); // connection-wide cooldown still applies
    const { calls } = mockSlackSuccess();
    await getDatabase().execute('UPDATE slack_connections SET rate_limit_until = NULL WHERE id = ?', [fixture.connectionId]);
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('schedules Slack JSON rate-limit errors even without an HTTP 429', async () => {
    const fixture = await slackFixture();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), { headers: { 'Retry-After': '90' } })));
    await processOneSlackNotificationDelivery('retry-worker');
    const row = (await getDatabase().queryOne<{ next_attempt_at: string; status: string }>('SELECT * FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))!;
    expect(row.status).toBe('pending');
    expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now() + 85_000);
  });

  it.each(['invalid_auth', 'token_revoked', 'missing_scope', 'user_not_found'])('does not retry permanent %s errors', async (error) => {
    const fixture = await slackFixture();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false, error })));
    vi.stubGlobal('fetch', fetchMock);
    await processOneSlackNotificationDelivery('retry-worker');
    expect(await getDatabase().queryOne('SELECT status, next_attempt_at FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))
      .toEqual({ status: 'failed', next_attempt_at: null });
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops at the fifth attempt', async () => {
    const fixture = await slackFixture();
    await getDatabase().execute('UPDATE slack_notification_deliveries SET attempt_count = 4 WHERE id = ?', [fixture.deliveryId]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await processOneSlackNotificationDelivery('retry-worker');
    expect(await getDatabase().queryOne('SELECT status, attempt_count FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))
      .toEqual({ status: 'failed', attempt_count: 5 });
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false);
  });

  it('cannot concurrently claim the same delivery', async () => {
    await slackFixture();
    const { fetchMock } = mockSlackSuccess();
    expect((await Promise.all([processOneSlackNotificationDelivery('worker-a'), processOneSlackNotificationDelivery('worker-b')])).sort()).toEqual([false, true]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['network', 'database'] as const)('does not blindly resend after an ambiguous %s acknowledgement', async (kind) => {
    const fixture = await slackFixture();
    const db = getDatabase();
    const { fetchMock } = mockSlackSuccess();
    if (kind === 'network') fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/chat.postMessage')) throw new TypeError('acknowledgement lost');
      return new Response(JSON.stringify({ ok: true, channel: { id: 'D123' } }));
    });
    else {
      const execute = db.execute.bind(db);
      vi.spyOn(db, 'execute').mockImplementation(async (sql, params) => {
        if (sql.includes("SET status = 'delivered'")) throw new Error('ack persistence unavailable');
        return execute(sql, params);
      });
    }
    await processOneSlackNotificationDelivery('retry-worker');
    const row = (await db.queryOne<{ status: string; post_started_at: string; error_category: string }>('SELECT * FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))!;
    expect(row.status).toBe('failed');
    expect(row.error_category).toBe('SLACK_DELIVERY_UNCERTAIN');
    expect(row.post_started_at).toBeTruthy();
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not resend a crashed send intent after lease expiry', async () => {
    const fixture = await slackFixture();
    await getDatabase().execute(`UPDATE slack_notification_deliveries SET status = 'processing', claimed_by = 'crashed',
      lease_expires_at = ?, post_started_at = ? WHERE id = ?`, [new Date(Date.now() - 1000).toISOString(), new Date().toISOString(), fixture.deliveryId]);
    const { fetchMock } = mockSlackSuccess();
    expect(await processOneSlackNotificationDelivery('retry-worker')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT status, error_category FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))
      .toEqual({ status: 'failed', error_category: 'SLACK_DELIVERY_UNCERTAIN' });
  });
});

describe('Interaction retry scheduling', () => {
  it('retries only a transient proposal-enqueue failure and respects the due time and max attempts', async () => {
    const fixture = await linkedSlackMigration();
    const db = getDatabase();
    await db.execute("UPDATE slack_interaction_jobs SET status = 'pending' WHERE id = ?", [fixture.interactionId]);
    const enqueue = vi.spyOn(proposals, 'enqueueMigrationProposal').mockRejectedValue(new Error('GITHUB_NETWORK'));
    await processOneSlackInteractionJob('interaction-worker', true);
    const row = (await db.queryOne<{ status: string; next_attempt_at: string }>('SELECT * FROM slack_interaction_jobs WHERE id = ?', [fixture.interactionId]))!;
    expect(row.status).toBe('pending');
    expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now() + 25_000);
    expect(await processOneSlackInteractionJob('interaction-worker', true)).toBe(false);
    expect(enqueue).toHaveBeenCalledTimes(1);
    await db.execute('UPDATE slack_interaction_jobs SET attempt_count = 2, next_attempt_at = NULL WHERE id = ?', [fixture.interactionId]);
    await processOneSlackInteractionJob('interaction-worker', true);
    expect(await db.queryOne('SELECT status, attempt_count FROM slack_interaction_jobs WHERE id = ?', [fixture.interactionId])).toEqual({ status: 'failed', attempt_count: 3 });
    expect(await db.queryOne('SELECT id FROM pull_requests')).toBeUndefined();
  });
});

describe('Migration 014 registration and upgrades', () => {
  it('uses idempotent PostgreSQL ALTERs and registers due-time/outcome indexes', async () => {
    const execute = vi.fn<(sql: string) => Promise<{ changes: number }>>().mockResolvedValue({ changes: 0 });
    // This tests generated DDL only; no claim is made that a production PostgreSQL migration ran.
    await slackReliabilityMigrations[0]!.up({ engine: 'postgres', execute } as unknown as DatabaseAdapter);
    const ddl = execute.mock.calls.map((call) => String(call[0])).join('\n');
    expect(ddl).toContain('ALTER TABLE slack_notification_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at TEXT');
    expect(ddl).toContain('ALTER TABLE slack_interaction_jobs ADD COLUMN IF NOT EXISTS next_attempt_at TEXT');
    expect(ddl).toContain('idx_slack_delivery_due');
    expect(ddl).toContain('idx_verification_terminal_outcomes');
    expect(ddl).not.toContain('DROP TABLE');
  });

  it('upgrades an existing 013 SQLite schema idempotently without rewriting migration 013', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(SQLITE_SCHEMA + SQLITE_VERIFICATION_WORKER_SCHEMA + SQLITE_SLACK_SCHEMA);
    const adapter = new SqliteDatabaseAdapter(raw);
    const migration = slackReliabilityMigrations[0]!;
    await migration.up(adapter);
    await migration.up(adapter);
    expect(raw.prepare('PRAGMA table_info(slack_notification_deliveries)').all().map((row) => row.name)).toContain('next_attempt_at');
    expect(raw.prepare('PRAGMA table_info(slack_notification_deliveries)').all().map((row) => row.name)).toContain('post_started_at');
    expect(migrations.find((entry) => entry.id === '014')?.id).toBe('014');
    await adapter.close();
  });
});
