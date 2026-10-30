import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { seedOfficialProviderReviewQueue } from '../apps/web/src/lib/server/provider-review-queue-seed.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-review-queue-seed.db');

describe('official provider review queue seeding', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('imports every official candidate as an unapproved review item', async () => {
    const first = await seedOfficialProviderReviewQueue(new Date('2026-10-29T12:00:00.000Z'));
    expect(first.candidates).toBe(50);
    expect(first.entries).toBe(50);
    expect(first.skippedExisting).toBe(0);

    const rows = await getDatabase().query<{ provider_id: string; status: string; workspace_id: string | null }>(
      'SELECT provider_id, status, workspace_id FROM provider_rule_candidates',
    );
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((row) => row.provider_id)).size).toBe(20);
    expect(rows.every((row) => row.status === 'needs_review' && row.workspace_id === null)).toBe(true);
    expect(await getDatabase().query('SELECT id FROM provider_rescan_jobs')).toHaveLength(0);
    expect(await getDatabase().query('SELECT id FROM provider_rule_reviews')).toHaveLength(0);
  });

  it('is idempotent and does not duplicate review items', async () => {
    await seedOfficialProviderReviewQueue(new Date('2026-10-29T12:00:00.000Z'));
    const second = await seedOfficialProviderReviewQueue(new Date('2026-10-29T12:05:00.000Z'));
    expect(second.candidates).toBe(0);
    expect(second.skippedExisting).toBe(50);
    expect(await getDatabase().query('SELECT id FROM provider_rule_candidates')).toHaveLength(50);
  });
});
