import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { planDueDigestDispatch, readApprovedDigestSchedule, type ApprovedDigestSchedule } from '../apps/web/src/lib/server/digest-scheduler.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-digest-scheduler-${process.pid}.db`);
const environmentKeys = ['NODE_ENV', 'APIPROOF_DB_PATH', 'APIPROOF_LOCAL_SEED_PASSWORD', 'MY_OWL_DIGEST_CADENCE', 'MY_OWL_DIGEST_DAY_UTC', 'MY_OWL_DIGEST_HOUR_UTC', 'MY_OWL_DIGEST_MINUTE_UTC', 'MY_OWL_DIGEST_CHANNEL'];
const savedEnvironment = new Map<string, string | undefined>();
const schedule: ApprovedDigestSchedule = { cadence: 'weekly', dayOfWeekUtc: 1, hourUtc: 9, minuteUtc: 0, channel: 'email' };

describe('digest scheduler integration boundary', () => {
  beforeEach(async () => {
    for (const key of environmentKeys) {
      savedEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_LOCAL_SEED_PASSWORD = 'Not05FixtureSeedPassword123!';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const key of environmentKeys) {
      const value = savedEnvironment.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      savedEnvironment.delete(key);
    }
  });

  it('requires an explicit approved schedule and does not invent cadence values', () => {
    expect(readApprovedDigestSchedule({})).toBeNull();
    expect(readApprovedDigestSchedule({ MY_OWL_DIGEST_CADENCE: 'weekly', MY_OWL_DIGEST_DAY_UTC: '1', MY_OWL_DIGEST_HOUR_UTC: '9', MY_OWL_DIGEST_MINUTE_UTC: '0', MY_OWL_DIGEST_CHANNEL: 'email' })).toEqual(schedule);
    expect(readApprovedDigestSchedule({ MY_OWL_DIGEST_CADENCE: 'weekly', MY_OWL_DIGEST_DAY_UTC: '8', MY_OWL_DIGEST_HOUR_UTC: '9', MY_OWL_DIGEST_MINUTE_UTC: '0', MY_OWL_DIGEST_CHANNEL: 'email' })).toBeNull();
  });

  it('fails closed before migration 025 is available', async () => {
    await expect(planDueDigestDispatch(new Date('2026-11-16T09:00:00.000Z'), schedule)).rejects.toMatchObject({ code: 'DIGEST_SCHEDULING_UNAVAILABLE' });
  });

  it('plans only enabled recipients during the approved UTC window', async () => {
    await getDatabase().execute(`
      CREATE TABLE user_notification_preferences (
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        channel TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, category, channel)
      )
    `);
    const enabled = await createUserWithSession('digest-enabled@example.test', 'OriginalPassword123!', 'Digest Enabled');
    const disabled = await createUserWithSession('digest-disabled@example.test', 'OriginalPassword123!', 'Digest Disabled');
    const now = new Date('2026-11-16T09:00:00.000Z');
    await getDatabase().execute('INSERT INTO user_notification_preferences (user_id, category, channel, enabled, updated_at) VALUES (?, ?, ?, ?, ?)', [enabled.user.id, 'weekly_digest', 'email', 1, now.toISOString()]);
    await getDatabase().execute('INSERT INTO user_notification_preferences (user_id, category, channel, enabled, updated_at) VALUES (?, ?, ?, ?, ?)', [disabled.user.id, 'weekly_digest', 'email', 0, now.toISOString()]);
    await expect(planDueDigestDispatch(now, schedule)).resolves.toEqual([{ userId: enabled.user.id, eventKey: `digest:2026-11-16:${enabled.user.id}:email`, category: 'weekly_digest', channel: 'email' }]);
    await expect(planDueDigestDispatch(new Date('2026-11-16T09:01:00.000Z'), schedule)).resolves.toEqual([]);
  });
});
