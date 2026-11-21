/**
 * Runtime classification shared by server code and the browser-test harness.
 *
 * The CI browser job serves a production Next build with a hermetic SQLite
 * database. That mode is explicit, requires CI plus a database-path override,
 * and is disabled whenever a PostgreSQL URL is present so a production-like
 * process cannot silently fall back to SQLite.
 */
export function isE2ETestRuntime(environment: NodeJS.ProcessEnv = process.env): boolean {
  const ci = ['1', 'true'].includes((environment.CI ?? '').trim().toLowerCase());
  const hasDatabaseUrl = Boolean(environment.DATABASE_URL?.trim() || environment.APIPROOF_DATABASE_URL?.trim());
  return environment.APIPROOF_E2E_TEST_MODE === 'true'
    && ci
    && Boolean(environment.APIPROOF_DB_PATH?.trim())
    && !hasDatabaseUrl;
}

export function isTestRuntime(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === 'test' || isE2ETestRuntime(environment);
}

export function isProductionRuntime(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === 'production' && !isE2ETestRuntime(environment);
}
