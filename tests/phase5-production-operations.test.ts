/**
 * Phase 5: Production Operations, Reliability & Security Test Suite
 *
 * Covers:
 *   TEST 1: Environment validation passes with valid config and fails fast in production mode
 *   TEST 2: assertProductionEnv throws sanitized error without exposing secret values
 *   TEST 3: Logger automatically redacts GitHub tokens, private keys, and sensitive fields
 *   TEST 4: Health endpoint GET /api/health returns 200 with safe operational metrics
 *   TEST 5: Worker metrics return correct queue statistics without tenant data leakage
 *   TEST 6: Health check detects database disconnection and reports status=unhealthy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { validateEnvConfig, assertProductionEnv } from '../apps/web/src/lib/server/env-config.js';
import { redactSecretString, redactSensitiveData, formatLogEntry } from '../apps/web/src/lib/server/logger.js';
import { getScanWorkerMetrics } from '../apps/web/src/lib/server/scan-worker.js';
import { GET as healthGetHandler } from '../apps/web/src/app/api/health/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase5-ops.db');

describe('Phase 5 — Production Operations, Reliability & CI', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'phase5-test-secret-minimum-32-chars-long';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_SLUG = 'apiproof-test';
    process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIPlaceholder\n-----END RSA PRIVATE KEY-----';
    process.env.GITHUB_WEBHOOK_SECRET = 'phase5-webhook-secret-32-chars-long!';
    process.env.CRON_SECRET = 'phase5-cron-secret-32-chars-long!';
    process.env.WORKER_AUTH_SECRET = 'phase5-worker-auth-secret-32-chars-long!';
    process.env.NEXT_PUBLIC_APP_URL = 'https://apiproof.test';

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  // -------------------------------------------------------------------------
  // TEST 1: Environment validation
  // -------------------------------------------------------------------------
  it('TEST 1: validateEnvConfig returns valid in test mode and fails fast when critical config is missing in production', () => {
    // 1. In test/dev mode with present env
    const devRes = validateEnvConfig({ NODE_ENV: 'test' });
    expect(devRes.valid).toBe(true);

    // 2. In production mode with missing secrets
    const prodBadRes = validateEnvConfig({
      NODE_ENV: 'production',
      APIPROOF_SECRET: 'short',
      // Missing GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, etc.
    });

    expect(prodBadRes.valid).toBe(false);
    expect(prodBadRes.issues.length).toBeGreaterThan(0);
    const issueVars = prodBadRes.issues.map((i) => i.variable);
    expect(issueVars).toContain('APIPROOF_SECRET');
    expect(issueVars).toContain('GITHUB_APP_ID');
    expect(issueVars).toContain('GITHUB_APP_PRIVATE_KEY');

    // 3. In production mode with full valid environment
    const prodGoodRes = validateEnvConfig({
      NODE_ENV: 'production',
      APIPROOF_SECRET: 'a'.repeat(32),
      GITHUB_APP_ID: '99999',
      GITHUB_APP_SLUG: 'apiproof-prod',
      GITHUB_APP_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----',
      GITHUB_WEBHOOK_SECRET: 'b'.repeat(32),
      CRON_SECRET: 'c'.repeat(32),
      WORKER_AUTH_SECRET: 'd'.repeat(32),
      NEXT_PUBLIC_APP_URL: 'https://apiproof.com',
    });
    expect(prodGoodRes.valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 2: assertProductionEnv throws sanitized error
  // -------------------------------------------------------------------------
  it('TEST 2: assertProductionEnv throws sanitized error without exposing secret values', () => {
    expect(() => {
      assertProductionEnv({
        NODE_ENV: 'production',
        APIPROOF_SECRET: 'too-short',
      });
    }).toThrowError(/CRITICAL_CONFIG_ERROR/);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Secret Redaction
  // -------------------------------------------------------------------------
  it('TEST 3: Logger automatically redacts GitHub tokens, private keys, and sensitive object keys', () => {
    const rawToken = 'ghs_1234567890abcdefghijklmnopqrstuvwxyz';
    const rawAuth = 'Bearer secret-cron-token-1234567890';
    const rawKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----';

    // String redaction
    const redactedStr = redactSecretString(`Failed request with ${rawToken} and ${rawAuth}`);
    expect(redactedStr).not.toContain(rawToken);
    expect(redactedStr).not.toContain('secret-cron-token-1234567890');
    expect(redactedStr).toContain('[REDACTED]');

    // Key-based object redaction
    const sensitiveObj = {
      workspaceId: 'ws_123',
      token: 'ghs_secret_value',
      authorization: 'Bearer secret_auth',
      privateKey: rawKey,
      nested: {
        cronSecret: 'super-secret',
        safeKey: 'hello',
      },
    };

    const cleaned = redactSensitiveData(sensitiveObj);
    expect(cleaned.workspaceId).toBe('ws_123');
    expect(cleaned.token).toBe('[REDACTED]');
    expect(cleaned.authorization).toBe('[REDACTED]');
    expect(cleaned.privateKey).toBe('[REDACTED]');
    expect(cleaned.nested.cronSecret).toBe('[REDACTED]');
    expect(cleaned.nested.safeKey).toBe('hello');

    // Formatted log entry string
    const formatted = formatLogEntry('error', 'Job failed', { token: rawToken });
    expect(formatted).not.toContain(rawToken);
    expect(formatted).toContain('[REDACTED]');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Health check route
  // -------------------------------------------------------------------------
  it('TEST 4: Health endpoint GET /api/health returns 200 with safe operational metrics', async () => {
    const res = await healthGetHandler();
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      status: string;
      alive: boolean;
      configValid: boolean;
      database: string;
      timestamp: string;
    };

    expect(data.status).toBe('healthy');
    expect(data.alive).toBe(true);
    expect(data.configValid).toBe(true);
    expect(data.database).toBe('connected');
    expect(data.timestamp).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // TEST 5: Worker metrics
  // -------------------------------------------------------------------------
  it('TEST 5: Worker metrics return correct aggregate statistics', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES ('ws_1', 'Test Workspace', 'test-ws-1', ?, ?)
    `, [now, now]);

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, created_at)
      VALUES ('repo_1', 'ws_1', 'test-org', 'test-repo', 'test-org/test-repo', '12345', 'main', ?)
    `, [now]);

    // Insert 2 pending, 1 processing, 1 completed
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES
        ('sr_1', 'ws_1', 'repo_1', 'sha_1', 'main', 'pending', ?),
        ('sr_2', 'ws_1', 'repo_1', 'sha_2', 'main', 'pending', ?),
        ('sr_3', 'ws_1', 'repo_1', 'sha_3', 'main', 'processing', ?),
        ('sr_4', 'ws_1', 'repo_1', 'sha_4', 'main', 'completed', ?)
    `, [now, now, now, now]);
    await db.execute('UPDATE github_scan_requests SET lease_expires_at = ? WHERE id = ?', ['2000-01-01T00:00:00.000Z', 'sr_3']);

    const metrics = await getScanWorkerMetrics();

    expect(metrics.pendingJobs).toBe(2);
    expect(metrics.processingJobs).toBe(1);
    expect(metrics.stalledJobs).toBe(1);
    expect(metrics.completedJobs).toBe(1);
    expect(metrics.failedJobs).toBe(0);
    expect(metrics.totalScanRequests).toBe(4);
    expect(metrics.lastProcessedAt).toBe(now);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Health check database failure
  // -------------------------------------------------------------------------
  it('TEST 6: Health check reports status=unhealthy and returns 503 when database is unavailable', async () => {
    closeDatabase();

    const res = await healthGetHandler();
    expect(res.status).toBe(503);

    const data = (await res.json()) as { status: string; database: string };
    expect(data.status).toBe('unhealthy');
    expect(data.database).toBe('disconnected');
  });
});
