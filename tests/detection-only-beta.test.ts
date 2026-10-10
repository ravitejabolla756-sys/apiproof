import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession, createUser } from '../apps/web/src/lib/server/auth.js';
import { migrationProposalsEnabled } from '../apps/web/src/lib/server/migration-proposal-capability.js';
import { CURRENT_BETA_CAPABILITIES } from '../apps/web/src/lib/beta-capabilities.js';
import { POST as planMigration } from '../apps/web/src/app/api/migrations/plan/route.js';
import { POST as proposeMigration } from '../apps/web/src/app/api/migrations/propose/route.js';

const TEST_DB_PATH = path.resolve('.tmp/test-detection-only-beta.db');

function routeRequest(pathname: string, sessionId: string, body: Record<string, string>): Request {
  return new Request(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `apiproof_session=${sessionId}`,
    },
    body: JSON.stringify(body),
  });
}

describe('detection-only public beta boundary', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'detection-only-beta-test-secret';
    delete process.env.APIPROOF_ENABLE_MIGRATION_PROPOSALS;
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* database does not exist yet */ }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* already closed */ }
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* database already removed */ }
    delete process.env.APIPROOF_DB_PATH;
    delete process.env.APIPROOF_SECRET;
    delete process.env.APIPROOF_ENABLE_MIGRATION_PROPOSALS;
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;
  });

  it('exposes only reviewed detection evidence as a current beta capability', () => {
    expect(CURRENT_BETA_CAPABILITIES).toMatchObject({
      mode: 'detection_only',
      reviewedProviderCount: 15,
      reviewedRuleCount: 20,
      migrationPlanningAvailable: false,
      draftPullRequestsAvailable: false,
    });
  });

  it('requires two explicit literal flags before migration proposal routes can be enabled', () => {
    expect(migrationProposalsEnabled({})).toBe(false);
    expect(migrationProposalsEnabled({ APIPROOF_ENABLE_MIGRATION_PROPOSALS: 'true' })).toBe(false);
    expect(migrationProposalsEnabled({ APIPROOF_ENABLE_LIVE_GITHUB_WRITE: 'true' })).toBe(false);
    expect(migrationProposalsEnabled({
      APIPROOF_ENABLE_MIGRATION_PROPOSALS: 'TRUE',
      APIPROOF_ENABLE_LIVE_GITHUB_WRITE: 'true',
    })).toBe(false);
    expect(migrationProposalsEnabled({
      APIPROOF_ENABLE_MIGRATION_PROPOSALS: 'true',
      APIPROOF_ENABLE_LIVE_GITHUB_WRITE: 'true',
    })).toBe(true);
  });

  it('fails closed before planning or queuing a migration proposal', async () => {
    const user = createUser('detection-only@example.com', 'Pass12345!', 'Detection Only');
    const session = createSession(user.id);

    const [planResponse, proposalResponse] = await Promise.all([
      planMigration(routeRequest('/api/migrations/plan', session.id, { findingId: 'finding_beta' })),
      proposeMigration(routeRequest('/api/migrations/propose', session.id, { migrationId: 'migration_beta' })),
    ]);

    expect(planResponse.status).toBe(503);
    await expect(planResponse.json()).resolves.toMatchObject({ code: 'MIGRATION_PROPOSALS_UNAVAILABLE' });
    expect(proposalResponse.status).toBe(503);
    await expect(proposalResponse.json()).resolves.toMatchObject({ code: 'MIGRATION_PROPOSALS_UNAVAILABLE' });
  });

  it('keeps public copy and navigation aligned with the detection-only boundary', () => {
    const publicSource = [
      'apps/web/src/app/page.tsx',
      'apps/web/src/app/pricing/page.tsx',
      'apps/web/src/app/features/page.tsx',
      'apps/web/src/app/how-it-works/page.tsx',
      'apps/web/src/app/security/page.tsx',
      'apps/web/src/app/docs/page.tsx',
      'apps/web/src/app/dashboard/page.tsx',
      'apps/web/src/components/dashboard/sidebar.tsx',
      'apps/web/src/components/dashboard/command-palette.tsx',
    ].map((file) => fs.readFileSync(path.resolve(file), 'utf8')).join('\n');
    const findingDetailSource = fs.readFileSync(
      path.resolve('apps/web/src/app/dashboard/findings/[id]/page.tsx'),
      'utf8',
    );

    expect(publicSource).toContain('Detection-only beta');
    expect(publicSource).toContain('15');
    expect(publicSource).toContain('20');
    expect(publicSource).not.toContain('2 verified draft PRs / mo');
    expect(publicSource).not.toContain('20 verified draft PRs / mo');
    expect(publicSource).not.toContain('100 verified draft PRs / mo');
    expect(publicSource).not.toContain('href: "/dashboard/migrations"');
    expect(publicSource).not.toContain('href: "/dashboard/pull-requests"');
    expect(findingDetailSource).toContain('CURRENT_BETA_CAPABILITIES.migrationPlanningAvailable');
  });
});
