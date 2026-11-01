export const runtime = 'nodejs';

/**
 * Apply idempotent application migrations before the first request in a
 * server process. This is required for PostgreSQL deployments because the
 * database is long-lived and cannot rely on SQLite's schema bootstrap path.
 *
 * The migration runner records applied IDs and each migration is written to
 * be safe to retry, so cold starts and rolling deployments converge on the
 * same schema without exposing migration SQL to request handlers.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrateProductionDatabase } = await import('./instrumentation-node.js');
    try {
      await migrateProductionDatabase();
    } catch (error) {
      // A database outage must not prevent the serverless process from
      // starting. Readiness routes report the database as disconnected, and
      // the next cold start retries the idempotent bootstrap. This keeps
      // public liveness and diagnostics available during a transient outage.
      console.error('PROVIDER_SCHEMA_BOOTSTRAP_DEFERRED', error);
    }
  }
}
