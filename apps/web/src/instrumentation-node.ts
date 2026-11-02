import { getDatabase } from './lib/server/db/index.js';
import { providerChangeMonitorMigrations } from './lib/server/db/provider-change-monitor-migration.js';
import { googleOAuthMigrations } from './lib/server/db/google-oauth-migration.js';
import { githubLoginMigrations } from './lib/server/db/github-login-migration.js';

/** Run the idempotent schema chain in the Node-only runtime. */
export async function migrateProductionDatabase(): Promise<void> {
  const database = getDatabase();

  if (database.engine !== 'postgres') return;

  // The production database already contains the historical application
  // schema. Apply only release-specific schemas here; do not replay the
  // legacy migration chain during every serverless cold start. The advisory
  // transaction lock makes concurrent cold starts safe.
  await database.transaction(async (tx) => {
    await tx.execute("SELECT pg_advisory_xact_lock(hashtext('apiproof:provider-monitoring-schema'))");
    const existing = await tx.queryOne<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'provider_rule_candidates'`
    );
    if (!existing) {
      await providerChangeMonitorMigrations[0]!.up(tx);
    }

    const googleState = await tx.queryOne<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'google_oauth_states'`
    );
    if (!googleState) {
      await googleOAuthMigrations[0]!.up(tx);
    }

    const githubState = await tx.queryOne<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'github_login_oauth_states'`
    );
    if (!githubState) {
      await githubLoginMigrations[0]!.up(tx);
    }
  });
}
