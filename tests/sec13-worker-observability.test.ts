import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { finishWorkerRun, getWorkerHeartbeats, pruneWorkerHeartbeatHistory, startWorkerRun } from '../apps/web/src/lib/server/worker-observability.js';

const TEST_DB_PATH = path.resolve('.tmp/test-sec13-worker-observability.db');
const ORIGINAL_DB_PATH = process.env.APIPROOF_DB_PATH;
const ORIGINAL_SKIP_SEED = process.env.APIPROOF_SKIP_DEFAULT_SEED;

describe('SEC-13 worker heartbeat and scheduler health', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (ORIGINAL_SKIP_SEED === undefined) delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
    else process.env.APIPROOF_SKIP_DEFAULT_SEED = ORIGINAL_SKIP_SEED;
    if (ORIGINAL_DB_PATH === undefined) delete process.env.APIPROOF_DB_PATH;
    else process.env.APIPROOF_DB_PATH = ORIGINAL_DB_PATH;
  });

  it('records separate concurrent run outcomes and sanitizes failure details', async () => {
    const startedAt = new Date('2026-11-07T00:00:00.000Z');
    const first = await startWorkerRun('provider-changelog-scheduler', startedAt);
    const second = await startWorkerRun('provider-changelog-scheduler', new Date(startedAt.getTime() + 1));
    await finishWorkerRun('provider-changelog-scheduler', first, 'failed', 'TOKEN=private-secret', new Date(startedAt.getTime() + 2));
    await finishWorkerRun('provider-changelog-scheduler', second, 'succeeded', null, new Date(startedAt.getTime() + 3));

    const latest = (await getWorkerHeartbeats(new Date(startedAt.getTime() + 4)))
      .find((item) => item.component === 'provider-changelog-scheduler');
    expect(latest).toMatchObject({ runId: second, status: 'succeeded', freshness: 'current', errorCode: null });
    expect(latest!.ageMs).toBe(3);
    expect(JSON.stringify(await getWorkerHeartbeats())).not.toContain('private-secret');
  });

  it('marks stale scheduled work and leaves unscheduled worker cadence unknown', async () => {
    const now = new Date('2026-11-07T12:00:00.000Z');
    await startWorkerRun('provider-changelog-scheduler', new Date(now.getTime() - 13 * 60 * 60 * 1_000));
    await startWorkerRun('scan-worker', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1_000));

    const health = await getWorkerHeartbeats(now);
    expect(health.find((item) => item.component === 'provider-changelog-scheduler')?.freshness).toBe('stale');
    expect(health.find((item) => item.component === 'nightly-rescan-scheduler')?.freshness).toBe('unknown');
    expect(health.find((item) => item.component === 'scan-worker')?.freshness).toBe('unknown');
  });

  it('bounds retained heartbeat history and rejects unsafe retention limits', async () => {
    const base = new Date('2026-11-07T00:00:00.000Z');
    for (let index = 0; index < 12; index += 1) {
      await startWorkerRun('nightly-rescan-scheduler', new Date(base.getTime() + index));
    }
    await expect(pruneWorkerHeartbeatHistory('nightly-rescan-scheduler', 9)).rejects.toThrow('WORKER_HEARTBEAT_INVALID_RETENTION');
    await pruneWorkerHeartbeatHistory('nightly-rescan-scheduler', 10);
    const retained = await getDatabase()
      .queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM worker_run_heartbeats WHERE component = 'nightly-rescan-scheduler'");
    expect(Number(retained?.count)).toBe(10);
  });

  it('keeps protected health status representable when the migration is not yet applied', async () => {
    await getDatabase().execute('DROP TABLE worker_run_heartbeats');
    const health = await getWorkerHeartbeats();

    expect(health).toHaveLength(3);
    expect(health.every((item) => item.status === 'unknown' && item.freshness === 'unknown')).toBe(true);
    expect(health.every((item) => item.errorCode === 'HEARTBEAT_STORE_UNAVAILABLE')).toBe(true);
  });
});
