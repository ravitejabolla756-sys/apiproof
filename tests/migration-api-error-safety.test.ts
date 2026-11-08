import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import * as planningService from '../apps/web/src/lib/server/planning-service.js';
import * as proposalService from '../apps/web/src/lib/server/proposal-service.js';
import { POST as planMigration } from '../apps/web/src/app/api/migrations/plan/route.js';
import { POST as proposeMigration } from '../apps/web/src/app/api/migrations/propose/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-migration-api-error-safety.db');
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  dbPath: process.env.APIPROOF_DB_PATH,
  secret: process.env.APIPROOF_SECRET,
};

describe('migration API safe error responses', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'migration-error-safety-test-secret-32-bytes';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment.nodeEnv;
    if (originalEnvironment.dbPath === undefined) delete process.env.APIPROOF_DB_PATH;
    else process.env.APIPROOF_DB_PATH = originalEnvironment.dbPath;
    if (originalEnvironment.secret === undefined) delete process.env.APIPROOF_SECRET;
    else process.env.APIPROOF_SECRET = originalEnvironment.secret;
  });

  it('hides dynamic and credential-shaped planning errors while retaining safe status mapping', async () => {
    const { session } = await createUserWithSession('migration-error-owner@example.test', 'StrongPassword123!', 'Migration Error Owner');
    const spy = vi.spyOn(planningService, 'generateMigrationForFinding')
      .mockRejectedValueOnce(new Error('Finding not found: AWS_SECRET_ACCESS_KEY:ABCD1234'))
      .mockRejectedValueOnce(new Error('AWS_SECRET_ACCESS_KEY:ABCD1234'));
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = () => planMigration(new Request('https://apiproof.test/api/migrations/plan', {
      method: 'POST',
      headers: { cookie: `apiproof_session=${session.id}`, 'content-type': 'application/json' },
      body: JSON.stringify({ findingId: 'fnd_safe_123' }),
    }));

    try {
      const notFound = await request();
      expect(notFound.status).toBe(404);
      expect(await notFound.json()).toEqual({ error: 'Resource not found or access denied.', code: 'NOT_FOUND' });
      const internal = await request();
      expect(internal.status).toBe(500);
      expect(await internal.json()).toEqual({ error: 'Migration planning failed.', code: 'PLANNING_FAILED' });
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain('ABCD1234');
    } finally {
      spy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('hides dynamic proposal conflict and plan-limit details', async () => {
    const { session } = await createUserWithSession('migration-proposal-error-owner@example.test', 'StrongPassword123!', 'Proposal Error Owner');
    const spy = vi.spyOn(proposalService, 'createGitHubProposal')
      .mockRejectedValueOnce(new Error('REPOSITORY_HEAD_DIVERGED: SHA 0123456789abcdef AWS_SECRET_ACCESS_KEY:ABCD1234'))
      .mockRejectedValueOnce(new Error('PLAN_LIMIT_EXCEEDED: AWS_SECRET_ACCESS_KEY:ABCD1234'));
    const request = () => proposeMigration(new Request('https://apiproof.test/api/migrations/propose', {
      method: 'POST',
      headers: { cookie: `apiproof_session=${session.id}`, 'content-type': 'application/json' },
      body: JSON.stringify({ migrationId: 'mig_safe_123' }),
    }));

    try {
      const conflict = await request();
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toEqual({
        error: 'The repository changed after the latest scan. Run a fresh scan before proposing a migration.',
        code: 'REPOSITORY_HEAD_DIVERGED',
      });
      const limited = await request();
      expect(limited.status).toBe(402);
      expect(await limited.json()).toEqual({
        error: 'The current plan does not allow another draft pull request.',
        code: 'PLAN_LIMIT_EXCEEDED',
        metric: 'draft_prs',
      });
    } finally {
      spy.mockRestore();
    }
  });
});
