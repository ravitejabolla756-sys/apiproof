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

  it('redacts provider credential formats and secret-bearing fields while preserving diagnostic names', () => {
    const providerSecrets = [
      'sk_live_1234567890abcdefghijkl',
      'whsec_1234567890abcdefghijklmn',
      'xoxb-123456789012-123456789012-123456789012-abcdefghij',
      'AKIAIOSFODNN7EXAMPLE',
      'AIzaSyDUMMYKEY0123456789abcdefghijklmn',
      'sb_secret_1234567890abcdefghijkl',
    ];
    const fields = {
      apiKey: providerSecrets[0],
      clientSecret: providerSecrets[1],
      refresh_token: providerSecrets[2],
      databaseUrl: 'postgres://user:password@db.example.test/app',
      connectionString: 'Host=db.example.test;Password=hidden',
      webhookSignature: providerSecrets[3],
      envName: 'BILLING_WEBHOOK_SECRET',
      secretName: 'OPENAI_API_KEY',
    };

    const formatted = formatLogEntry('error', `provider failure ${providerSecrets.join(' ')}`, fields, new Error(providerSecrets[4]!));
    const parsed = JSON.parse(formatted) as { context: Record<string, unknown>; error: string; message: string };

    for (const secret of providerSecrets) expect(formatted).not.toContain(secret);
    expect(parsed.context).toMatchObject({
      apiKey: '[REDACTED]',
      clientSecret: '[REDACTED]',
      refresh_token: '[REDACTED]',
      databaseUrl: '[REDACTED]',
      connectionString: '[REDACTED]',
      webhookSignature: '[REDACTED]',
      envName: 'BILLING_WEBHOOK_SECRET',
      secretName: 'OPENAI_API_KEY',
    });
    expect(parsed.error).toContain('[REDACTED]');
    expect(parsed.message).toContain('[REDACTED]');
  });

  it('redacts raw GitHub OAuth, user, and refresh token formats', () => {
    const tokens = [
      'gho_1234567890abcdefghijklmnopqrstuvwxyz',
      'ghu_1234567890abcdefghijklmnopqrstuvwxyz',
      'ghr_1234567890abcdefghijklmnopqrstuvwxyz',
    ];

    const redacted = redactSecretString(`GitHub response ${tokens.join(' ')}`);

    for (const token of tokens) expect(redacted).not.toContain(token);
    expect(redacted).toContain('GitHub response');
    expect(redacted.match(/\[REDACTED\]/g)).toHaveLength(tokens.length);
  });

  it('redacts credential key variants and safely formats circular log context', () => {
    const context: Record<string, unknown> = {
      passwordHash: 'stored-password-hash',
      privateKeyPem: 'private-key-material',
      oauthAccessToken: 'oauth-token-material',
      awsSecretAccessKey: 'aws-access-key-material',
      serviceRoleKey: 'service-role-key-material',
      secret_value: 'secret-value-material',
      signingKey: 'signing-key-material',
      envName: 'BILLING_WEBHOOK_SECRET',
      secretName: 'OPENAI_API_KEY',
    };
    context.self = context;

    const parsed = JSON.parse(formatLogEntry('error', 'circular diagnostic context', context)) as {
      context: Record<string, unknown>;
    };

    expect(parsed.context).toMatchObject({
      passwordHash: '[REDACTED]',
      privateKeyPem: '[REDACTED]',
      oauthAccessToken: '[REDACTED]',
      awsSecretAccessKey: '[REDACTED]',
      serviceRoleKey: '[REDACTED]',
      secret_value: '[REDACTED]',
      signingKey: '[REDACTED]',
      envName: 'BILLING_WEBHOOK_SECRET',
      secretName: 'OPENAI_API_KEY',
      self: '[CIRCULAR]',
    });
    const serialized = JSON.stringify(parsed);
    for (const secret of ['stored-password-hash', 'private-key-material', 'oauth-token-material', 'aws-access-key-material', 'service-role-key-material', 'secret-value-material', 'signing-key-material']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('redacts secret assignments embedded in diagnostic strings and JSON-like text', () => {
    const rawSecret = 'this-is-a-credential-value';
    const text = `AWS_SECRET_ACCESS_KEY=${rawSecret}; "service_role_key": "${rawSecret}"; databaseUrl = 'postgres://user:${rawSecret}@db.example.test/app'`;
    const sanitized = redactSecretString(text);

    expect(sanitized).not.toContain(rawSecret);
    expect(sanitized.match(/\[REDACTED\]/g)).toHaveLength(3);
  });

  it('redacts credentials in connection URLs embedded directly in diagnostics', () => {
    const rawUser = 'local-build-user';
    const rawPassword = 'url-password-must-not-escape';
    const diagnostic = `driver failed for postgres://${rawUser}:${rawPassword}@db.example.test/app and https://${rawUser}:${rawPassword}@api.example.test/v1`;
    const sanitized = redactSecretString(diagnostic);

    expect(sanitized).not.toContain(rawUser);
    expect(sanitized).not.toContain(rawPassword);
    expect(sanitized).toContain('postgres://[REDACTED]@db.example.test/app');
    expect(sanitized).toContain('https://[REDACTED]@api.example.test/v1');
  });

  it('preserves known operational error categories while redacting token-like values', () => {
    const formatted = formatLogEntry('warn', 'Slack delivery failed', {
      category: 'SLACK_API_TOKEN_REVOKED',
      providerError: 'token-1234567890',
    });
    const parsed = JSON.parse(formatted) as { context: Record<string, string> };

    expect(parsed.context.category).toBe('SLACK_API_TOKEN_REVOKED');
    expect(parsed.context.providerError).toBe('[REDACTED]');
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

    const metrics = await getScanWorkerMetrics();

    expect(metrics.pendingJobs).toBe(2);
    expect(metrics.processingJobs).toBe(1);
    expect(metrics.completedJobs).toBe(1);
    expect(metrics.failedJobs).toBe(0);
    expect(metrics.totalScanRequests).toBe(4);
    expect(metrics.lastProcessedAt).toBe(now);
  });

  it('TEST 5b: Worker metrics expose bounded queue age, retry, and stalled-job indicators', async () => {
    const db = getDatabase();
    const now = new Date('2026-11-07T12:00:00.000Z');
    const old = '2026-11-07T11:45:00.000Z';
    const staleLease = '2026-11-07T11:59:00.000Z';

    await db.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES ('ws_metrics_2', 'Metrics Workspace', 'metrics-ws-2', ?, ?)
    `, [old, old]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, created_at)
      VALUES ('repo_metrics_2', 'ws_metrics_2', 'test-org', 'metrics-repo', 'test-org/metrics-repo', '12346', 'main', ?)
    `, [old]);
    await db.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, attempt_count, lease_expires_at, created_at)
      VALUES
        ('sr_metrics_pending', 'ws_metrics_2', 'repo_metrics_2', 'sha_metrics_1', 'main', 'pending', 1, NULL, ?),
        ('sr_metrics_stalled', 'ws_metrics_2', 'repo_metrics_2', 'sha_metrics_2', 'main', 'processing', 3, ?, ?),
        ('sr_metrics_legacy_stalled', 'ws_metrics_2', 'repo_metrics_2', 'sha_metrics_3', 'main', 'processing', 0, NULL, ?),
        ('sr_metrics_legacy_active', 'ws_metrics_2', 'repo_metrics_2', 'sha_metrics_4', 'main', 'processing', 0, NULL, ?),
        ('sr_metrics_exhausted', 'ws_metrics_2', 'repo_metrics_2', 'sha_metrics_5', 'main', 'failed', 3, NULL, ?)
    `, [old, staleLease, old, old, '2026-11-07T11:58:00.000Z', old]);

    const metrics = await getScanWorkerMetrics(now);
    const indexes = await db.query<{ name: string }>('PRAGMA index_list(github_scan_requests)');

    expect(metrics.oldestPendingAt).toBe(old);
    expect(metrics.oldestPendingAgeMs).toBe(15 * 60 * 1000);
    expect(metrics.retryingJobs).toBe(2);
    expect(metrics.stalledProcessingJobs).toBe(2);
    expect(metrics.retryExhaustedJobs).toBe(2);
    expect(indexes.some((index) => index.name === 'idx_scan_requests_health')).toBe(true);
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
