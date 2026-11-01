import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { PROVIDER_CHANGE_SOURCES } from '../apps/web/src/lib/server/provider-change-monitor.js';
import { getProviderSourceHealth } from '../apps/web/src/lib/server/provider-source-health.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-source-health.db');

describe('provider source health freshness', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_DB_PATH;
  });

  it('marks a successful source due when the last success is older than six hours', async () => {
    const source = PROVIDER_CHANGE_SOURCES.find((entry) => entry.providerId === 'stripe');
    expect(source).toBeDefined();
    const observedAt = new Date('2026-10-29T12:00:00.000Z');
    await getDatabase().execute(`
      INSERT INTO provider_change_sources
        (id, provider_id, source_url, source_type, adapter_id, enabled, last_success_at, next_attempt_at, failure_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)
    `, [source!.id, source!.providerId, source!.sourceUrl, source!.sourceType, source!.adapterId,
      '2026-10-29T04:59:59.000Z', '2026-10-29T13:00:00.000Z', observedAt.toISOString(), observedAt.toISOString()]);

    const health = await getProviderSourceHealth(observedAt);
    expect(health.find((entry) => entry.providerId === 'stripe')).toMatchObject({ status: 'due', failureCount: 0 });
  });

  it('keeps a recent successful source healthy until its next scheduled attempt', async () => {
    const source = PROVIDER_CHANGE_SOURCES.find((entry) => entry.providerId === 'stripe');
    expect(source).toBeDefined();
    const observedAt = new Date('2026-10-29T12:00:00.000Z');
    await getDatabase().execute(`
      INSERT INTO provider_change_sources
        (id, provider_id, source_url, source_type, adapter_id, enabled, last_success_at, next_attempt_at, failure_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)
    `, [source!.id, source!.providerId, source!.sourceUrl, source!.sourceType, source!.adapterId,
      '2026-10-29T07:00:00.000Z', '2026-10-29T13:00:00.000Z', observedAt.toISOString(), observedAt.toISOString()]);

    const health = await getProviderSourceHealth(observedAt);
    expect(health.find((entry) => entry.providerId === 'stripe')).toMatchObject({ status: 'healthy', failureCount: 0 });
  });

  it('prefers live parser telemetry over evidence-only seeded candidates', async () => {
    const source = PROVIDER_CHANGE_SOURCES.find((entry) => entry.providerId === 'slack');
    expect(source).toBeDefined();
    const observedAt = new Date('2026-10-29T12:00:00.000Z');
    await getDatabase().execute(`
      INSERT INTO provider_change_sources
        (id, provider_id, source_url, source_type, adapter_id, enabled, last_success_at, next_attempt_at, failure_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)
    `, [source!.id, source!.providerId, source!.sourceUrl, source!.sourceType, source!.adapterId,
      observedAt.toISOString(), '2026-10-29T13:00:00.000Z', observedAt.toISOString(), observedAt.toISOString()]);

    const insertEntry = async (id: string, key: string, evidence: unknown, lastSeenAt: string) => getDatabase().execute(`
      INSERT INTO provider_changelog_entries
        (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, source!.id, source!.providerId, key, key, key, source!.sourceUrl, source!.sourceUrl, id.padEnd(64, '0'), JSON.stringify(evidence), observedAt.toISOString(), lastSeenAt]);

    await insertEntry('seed-entry', 'seed', { candidate: true }, new Date(observedAt.getTime() + 10_000).toISOString());
    await insertEntry('live-entry', 'live', { parserStatus: 'structured' }, new Date(observedAt.getTime() - 10_000).toISOString());

    const health = await getProviderSourceHealth(observedAt);
    expect(health.find((entry) => entry.providerId === 'slack')?.parserStatus).toBe('structured');
  });
});
