import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as healthGetHandler } from '../apps/web/src/app/api/health/route.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { claimWebhookDelivery, recordWebhookDelivery, verifyWebhookSignature } from '../apps/web/src/lib/server/github-webhooks.js';
import { getScanWorkerMetrics } from '../apps/web/src/lib/server/scan-worker.js';
import { runBoundedRetryScenario, runLocalLoadScenario, type LoadReport } from './sec16-load-resilience-harness.js';

const TEST_DB_PATH = path.resolve('.tmp/test-sec16-load-resilience.db');
const WEBHOOK_SECRET = 'sec16-local-webhook-secret';
const ENVIRONMENT_KEYS = [
  'NODE_ENV', 'APIPROOF_DB_PATH', 'APIPROOF_SKIP_DEFAULT_SEED', 'DATABASE_URL',
  'APIPROOF_DATABASE_URL', 'APIPROOF_STAGING_DATABASE_URL', 'APIPROOF_SECRET',
  'GITHUB_WEBHOOK_SECRET', 'NEXT_PUBLIC_APP_URL',
] as const;
let originalEnvironment: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string>>;

function signedBody(rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex')}`;
}

function expectHealthyReport(report: LoadReport, expectedIterations: number, concurrency: number): void {
  expect(report.iterations).toBe(expectedIterations);
  expect(report.started).toBe(expectedIterations);
  expect(report.notStarted).toBe(0);
  expect(report.succeeded).toBe(expectedIterations);
  expect(report.failed).toBe(0);
  expect(report.errorRate).toBe(0);
  expect(report.maxInFlight).toBeLessThanOrEqual(concurrency);
  expect(report.throughputPerSecond).toBeGreaterThan(0);
  expect(report.latencyMs.p95).toBeGreaterThanOrEqual(report.latencyMs.p50);
  expect(report.latencyMs.p99).toBeGreaterThanOrEqual(report.latencyMs.p95);
  expect(report.errors).toEqual({});
}

describe('SEC-16 — deterministic local load and resilience harness', () => {
  beforeEach(() => {
    originalEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.APIPROOF_DATABASE_URL;
    delete process.env.APIPROOF_STAGING_DATABASE_URL;
    process.env.APIPROOF_SECRET = 'sec16-local-test-secret-minimum-32-chars';
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = 'https://apiproof.test';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* test cleanup */ }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const key of ENVIRONMENT_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('measures bounded in-process API, webhook, database, and worker operations', async () => {
    const iterations = 24;
    const concurrency = 4;
    const fixedNow = new Date('2026-11-07T12:00:00.000Z');
    const db = getDatabase();

    await db.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES ('sec16_ws', 'SEC16 Workspace', 'sec16-workspace', ?, ?)
    `, [fixedNow.toISOString(), fixedNow.toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, created_at)
      VALUES ('sec16_repo', 'sec16_ws', 'local', 'sec16', 'local/sec16', 'sec16', 'main', ?)
    `, [fixedNow.toISOString()]);
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES ('sec16_scan', 'sec16_ws', 'sec16_repo', 'sec16sha', 'main', 'pending', ?)
    `, [fixedNow.toISOString()]);

    const reports = [] as LoadReport[];
    reports.push(await runLocalLoadScenario({
      name: 'api-health',
      iterations,
      concurrency,
      operation: async () => {
        const response = await healthGetHandler();
        if (response.status !== 200) throw new Error('API_HEALTH_FAILED');
      },
    }));
    reports.push(await runLocalLoadScenario({
      name: 'github-webhook-ping',
      iterations,
      concurrency,
      operation: async (iteration) => {
        const rawBody = JSON.stringify({ zen: 'SEC16 local fixture', iteration });
        const deliveryId = `sec16-delivery-${iteration}`;
        if (!verifyWebhookSignature(rawBody, signedBody(rawBody), WEBHOOK_SECRET)) {
          throw new Error('WEBHOOK_SIGNATURE_FAILED');
        }
        if (!await claimWebhookDelivery(deliveryId, 'ping', fixedNow.toISOString())) {
          throw new Error('WEBHOOK_CLAIM_FAILED');
        }
        await recordWebhookDelivery(deliveryId, 'ping', 'processed', fixedNow.toISOString());
      },
    }));
    reports.push(await runLocalLoadScenario({
      name: 'sqlite-query',
      iterations,
      concurrency,
      operation: async () => {
        const row = await getDatabase().queryOne<{ alive: number }>('SELECT 1 AS alive');
        if (row?.alive !== 1) throw new Error('DATABASE_LOCAL_FAILED');
      },
    }));
    reports.push(await runLocalLoadScenario({
      name: 'worker-queue-metrics',
      iterations,
      concurrency,
      operation: async () => {
        const metrics = await getScanWorkerMetrics();
        if (metrics.pendingJobs !== 1 || metrics.totalScanRequests !== 1) throw new Error('WORKER_METRICS_FAILED');
      },
    }));

    for (const report of reports) expectHealthyReport(report, iterations, concurrency);
    console.info(`SEC16_LOCAL_MEASUREMENTS ${JSON.stringify(reports.map(({ name, iterations: count, durationMs, throughputPerSecond, maxInFlight, latencyMs }) => ({ name, iterations: count, durationMs, throughputPerSecond, maxInFlight, latencyMs })))}`);
    expect(reports.map((report) => report.name)).toEqual([
      'api-health', 'github-webhook-ping', 'sqlite-query', 'worker-queue-metrics',
    ]);
  });

  it('reaches the configured concurrency without exceeding its bound', async () => {
    let observedInFlight = 0;
    let observedMaximum = 0;
    const report = await runLocalLoadScenario({
      name: 'bounded-concurrency',
      iterations: 12,
      concurrency: 3,
      operation: async () => {
        observedInFlight += 1;
        observedMaximum = Math.max(observedMaximum, observedInFlight);
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        observedInFlight -= 1;
      },
    });

    expect(report.succeeded).toBe(12);
    expect(report.failed).toBe(0);
    expect(report.maxInFlight).toBe(3);
    expect(observedMaximum).toBe(3);
    expect(observedInFlight).toBe(0);
  });

  it('recovers from bounded transient failure without exceeding the retry budget', async () => {
    const report = await runBoundedRetryScenario({
      maxAttempts: 4,
      operation: (attempt) => {
        if (attempt < 3) throw new Error('INJECTED_TRANSIENT_FAILURE');
      },
    });

    expect(report).toEqual({
      status: 'recovered',
      attempts: 3,
      errors: ['INJECTED_TRANSIENT_FAILURE', 'INJECTED_TRANSIENT_FAILURE'],
    });
  });

  it('records bounded exhaustion and sanitized failure codes', async () => {
    const report = await runBoundedRetryScenario({
      maxAttempts: 3,
      operation: () => {
        throw new Error('INJECTED_RETRY_EXHAUSTION');
      },
    });

    expect(report).toEqual({
      status: 'exhausted',
      attempts: 3,
      errors: ['INJECTED_RETRY_EXHAUSTION', 'INJECTED_RETRY_EXHAUSTION', 'INJECTED_RETRY_EXHAUSTION'],
    });
  });

  it('times out a retry attempt, signals abort, and does not overlap a retry', async () => {
    let attemptsStarted = 0;
    let signalAborted = false;
    const report = await runBoundedRetryScenario({
      maxAttempts: 4,
      timeoutMs: 5,
      operation: (_attempt, signal) => {
        attemptsStarted += 1;
        signal.addEventListener('abort', () => { signalAborted = true; }, { once: true });
        return new Promise<void>(() => undefined);
      },
    });

    expect(attemptsStarted).toBe(1);
    expect(signalAborted).toBe(true);
    expect(report).toEqual({ status: 'exhausted', attempts: 1, errors: ['OPERATION_TIMEOUT'] });
  });

  it('rejects unsafe or unbounded scenario labels before executing operations', async () => {
    let operationCalled = false;
    await expect(runLocalLoadScenario({
      name: 'scenario secret=must-not-be-recorded',
      iterations: 1,
      concurrency: 1,
      operation: () => { operationCalled = true; },
    })).rejects.toThrow('SEC16_INVALID_SCENARIO_NAME');
    await expect(runLocalLoadScenario({
      name: 'x'.repeat(65),
      iterations: 1,
      concurrency: 1,
      operation: () => { operationCalled = true; },
    })).rejects.toThrow('SEC16_INVALID_SCENARIO_NAME');
    expect(operationCalled).toBe(false);
  });

  it('rejects aggregate load and retry durations over one minute before invoking callbacks', async () => {
    let operationCalled = false;
    await expect(runLocalLoadScenario({
      name: 'duration-bound',
      iterations: 200,
      concurrency: 1,
      timeoutMs: 60_000,
      operation: () => { operationCalled = true; },
    })).rejects.toThrow('SEC16_SCENARIO_DURATION_EXCEEDED');
    await expect(runBoundedRetryScenario({
      maxAttempts: 10,
      timeoutMs: 6_001,
      operation: () => { operationCalled = true; },
    })).rejects.toThrow('SEC16_SCENARIO_DURATION_EXCEEDED');
    expect(operationCalled).toBe(false);
  });

  it('refuses production mode and configured remote databases before invoking work', async () => {
    let operationCalled = false;
    const scenario = {
      name: 'safety-boundary',
      iterations: 1,
      concurrency: 1,
      operation: () => { operationCalled = true; },
    };
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      await expect(runLocalLoadScenario(scenario)).rejects.toThrow('SEC16_LOCAL_ONLY');
      process.env.NODE_ENV = 'test';
      for (const variable of ['DATABASE_URL', 'APIPROOF_DATABASE_URL', 'APIPROOF_STAGING_DATABASE_URL']) {
        process.env[variable] = 'postgres://example.invalid/local-safety-test';
        await expect(runLocalLoadScenario(scenario)).rejects.toThrow('SEC16_LOCAL_ONLY');
        delete process.env[variable];
      }
      expect(operationCalled).toBe(false);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('injects deterministic operation failures and reports only bounded error codes', async () => {
    const report = await runLocalLoadScenario({
      name: 'injected-local-api-failure',
      iterations: 8,
      concurrency: 2,
      operation: (iteration) => {
        if (iteration === 2 || iteration === 6) throw new Error('INJECTED_API_FAILURE');
        if (iteration === 4) throw new Error('AWS_SECRET_ACCESS_KEY:ABCD1234MUSTNOTESCAPE');
        if (iteration === 5) throw new Error('token=secret-must-not-escape');
      },
    });

    expect(report.iterations).toBe(8);
    expect(report.succeeded).toBe(4);
    expect(report.failed).toBe(4);
    expect(report.errorRate).toBe(0.5);
    expect(report.maxInFlight).toBeLessThanOrEqual(2);
    expect(report.errors).toEqual({ INJECTED_API_FAILURE: 2, OPERATION_FAILED: 2 });
    expect(JSON.stringify(report)).not.toContain('secret-must-not-escape');
    expect(JSON.stringify(report)).not.toContain('ABCD1234MUSTNOTESCAPE');
  });

  it('records a bounded rate-limit failure ratio without contacting a service', async () => {
    const report = await runLocalLoadScenario({
      name: 'injected-rate-limit',
      iterations: 12,
      concurrency: 3,
      operation: (iteration) => {
        if (iteration % 3 === 0) throw new Error('INJECTED_RATE_LIMITED');
      },
    });

    expect(report).toMatchObject({
      iterations: 12,
      started: 12,
      succeeded: 8,
      failed: 4,
      errorRate: 1 / 3,
      maxInFlight: 3,
      errors: { INJECTED_RATE_LIMITED: 4 },
    });
  });

  it('signals cooperative cancellation when an operation exceeds its deadline', async () => {
    let signalAborted = false;
    const report = await runLocalLoadScenario({
      name: 'injected-timeout',
      iterations: 1,
      concurrency: 1,
      timeoutMs: 5,
      operation: (_iteration, signal) => new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          signalAborted = true;
          reject(new Error('OPERATION_ABORTED'));
        }, { once: true });
      }),
    });

    expect(signalAborted).toBe(true);
    expect(report).toMatchObject({ iterations: 1, succeeded: 0, failed: 1, errors: { OPERATION_TIMEOUT: 1 } });
  });

  it('stops scheduling after timeout when an operation does not settle on abort', async () => {
    let started = 0;
    const report = await runLocalLoadScenario({
      name: 'timeout-stops-schedule',
      iterations: 5,
      concurrency: 1,
      timeoutMs: 5,
      operation: () => {
        started += 1;
        return new Promise<void>(() => undefined);
      },
    });

    expect(started).toBe(1);
    expect(report).toMatchObject({
      iterations: 5,
      started: 1,
      notStarted: 4,
      succeeded: 0,
      failed: 1,
      maxInFlight: 1,
      errors: { OPERATION_TIMEOUT: 1 },
    });
    expect(report.throughputPerSecond).toBeCloseTo((report.started / report.durationMs) * 1_000, 8);
  });

  it('stops scheduling across all active workers after a timeout', async () => {
    let started = 0;
    const report = await runLocalLoadScenario({
      name: 'parallel-timeout-stops-schedule',
      iterations: 6,
      concurrency: 2,
      timeoutMs: 10,
      operation: () => {
        started += 1;
        return new Promise<void>(() => undefined);
      },
    });

    expect(started).toBe(2);
    expect(report).toMatchObject({
      iterations: 6,
      started: 2,
      notStarted: 4,
      succeeded: 0,
      failed: 2,
      maxInFlight: 2,
      errors: { OPERATION_TIMEOUT: 2 },
    });
  });
});
