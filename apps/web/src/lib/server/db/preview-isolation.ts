import type { DatabaseAdapter } from './types.js';

export const PREVIEW_STAGING_ISOLATION_ENV = 'APIPROOF_PREVIEW_STAGING_ISOLATION';
export const PREVIEW_STAGING_PROJECT_REF = 'elzkxgfsciivlrejujwb';
export const PREVIEW_STAGING_DATABASE_URL_USERNAME = `postgres.${PREVIEW_STAGING_PROJECT_REF}`;
export const PREVIEW_STAGING_DATABASE_SESSION_USER = 'postgres';
export const PREVIEW_STAGING_DATABASE_NAME = 'postgres';

export interface PreviewStagingDatabaseConfig {
  databaseUrl: string;
  urlUsername: string;
  databaseName: string;
}

function decodeDatabaseIdentity(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: database URL identity is malformed');
  }
}

/**
 * Resolves only the explicitly approved staging database configuration.
 * The URL itself is retained for the database driver but never included in
 * thrown errors or runtime verification responses.
 */
export function readPreviewStagingDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PreviewStagingDatabaseConfig {
  if (environment[PREVIEW_STAGING_ISOLATION_ENV] !== 'true') {
    throw new Error('PREVIEW_STAGING_ISOLATION_DISABLED');
  }
  if (environment.DATABASE_URL?.trim()) {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: DATABASE_URL must be unset');
  }

  const databaseUrl = environment.APIPROOF_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: APIPROOF_DATABASE_URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: invalid PostgreSQL URL');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: PostgreSQL URL required');
  }

  const hostname = parsed.hostname.toLowerCase();
  const isPoolerHost = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(hostname);
  const isDirectProjectHost = hostname === `db.${PREVIEW_STAGING_PROJECT_REF}.supabase.co`;
  if (!isPoolerHost && !isDirectProjectHost) {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: unexpected database host');
  }

  const urlUsername = decodeDatabaseIdentity(parsed.username);
  const databaseName = decodeDatabaseIdentity(parsed.pathname.replace(/^\//, ''));
  if (urlUsername !== PREVIEW_STAGING_DATABASE_URL_USERNAME) {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: unexpected staging project identity');
  }
  if (databaseName !== PREVIEW_STAGING_DATABASE_NAME) {
    throw new Error('PREVIEW_STAGING_ISOLATION_REFUSED: unexpected staging database name');
  }

  return { databaseUrl, urlUsername, databaseName };
}

/**
 * Read-only runtime identity check. It deliberately returns only a boolean;
 * database usernames, names, hosts, and connection strings never leave this
 * server-side boundary.
 */
export async function verifyPreviewStagingDatabaseIdentity(
  db: Pick<DatabaseAdapter, 'engine' | 'queryOne'>,
  config: PreviewStagingDatabaseConfig,
): Promise<boolean> {
  if (db.engine !== 'postgres') return false;

  try {
    const identity = await db.queryOne<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user',
    );
    return identity?.database_name === config.databaseName
      && identity.database_user === PREVIEW_STAGING_DATABASE_SESSION_USER;
  } catch {
    return false;
  }
}
