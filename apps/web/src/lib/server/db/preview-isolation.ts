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

export type PreviewStagingDatabaseFailureCategory =
  | 'DB_CONFIG_MISSING'
  | 'DB_CONFIG_INVALID'
  | 'DB_POOL_CONSTRUCTION_FAILED'
  | 'DB_TLS_CERTIFICATE_UNTRUSTED'
  | 'DB_TLS_CERTIFICATE_EXPIRED'
  | 'DB_TLS_HOSTNAME_MISMATCH'
  | 'DB_TLS_HANDSHAKE_FAILED'
  | 'DB_AUTHENTICATION_FAILED'
  | 'DB_DNS_FAILED'
  | 'DB_CONNECTION_TIMEOUT'
  | 'DB_CONNECTION_REFUSED'
  | 'DB_CONNECTION_RESET'
  | 'DB_CONNECTION_OTHER'
  | 'DB_QUERY_FAILED'
  | 'DB_IDENTITY_MISMATCH'
  | 'DB_ADAPTER_UNEXPECTED'
  | 'DB_FAILURE_UNCLASSIFIED';

export type PreviewStagingDatabaseFailureStage =
  | 'configuration'
  | 'adapter-construction'
  | 'identity-query'
  | 'identity-comparison';

export interface PreviewStagingDatabaseIdentityResult {
  verified: boolean;
  failureCategory?: PreviewStagingDatabaseFailureCategory;
  failureStage?: PreviewStagingDatabaseFailureStage;
}

const TLS_UNTRUSTED_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
]);

function knownErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { code?: unknown; cause?: unknown };
  if (typeof value.code === 'string') return value.code;
  if (value.cause && value.cause !== error) return knownErrorCode(value.cause);
  return undefined;
}

export function classifyPreviewStagingDatabaseError(
  error: unknown,
  stage: PreviewStagingDatabaseFailureStage,
): PreviewStagingDatabaseFailureCategory {
  const code = knownErrorCode(error);
  const message = error instanceof Error ? error.message : '';

  if (message === 'PREVIEW_STAGING_ISOLATION_REFUSED: APIPROOF_DATABASE_URL is required') {
    return 'DB_CONFIG_MISSING';
  }
  if (message.startsWith('PREVIEW_STAGING_')
    || message === 'POSTGRES_POOL_MAX_INVALID'
    || message === 'POSTGRES_SSL_CONFIGURATION_CONFLICT'
    || message === 'POSTGRES_TLS_DISABLE_REFUSED') {
    return 'DB_CONFIG_INVALID';
  }
  if (TLS_UNTRUSTED_CODES.has(code ?? '')) return 'DB_TLS_CERTIFICATE_UNTRUSTED';
  if (code === 'CERT_HAS_EXPIRED') return 'DB_TLS_CERTIFICATE_EXPIRED';
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'DB_TLS_HOSTNAME_MISMATCH';
  if (code?.startsWith('ERR_TLS_')) return 'DB_TLS_HANDSHAKE_FAILED';
  if (code === '28P01' || code === '28000') return 'DB_AUTHENTICATION_FAILED';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DB_DNS_FAILED';
  if (code === 'ETIMEDOUT') return 'DB_CONNECTION_TIMEOUT';
  if (code === 'ECONNREFUSED') return 'DB_CONNECTION_REFUSED';
  if (code === 'ECONNRESET') return 'DB_CONNECTION_RESET';
  if (code?.startsWith('ECONN') || code === 'EPIPE') return 'DB_CONNECTION_OTHER';
  if (stage === 'adapter-construction') return 'DB_POOL_CONSTRUCTION_FAILED';
  if (stage === 'identity-query') return 'DB_QUERY_FAILED';
  return 'DB_FAILURE_UNCLASSIFIED';
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
  return (await verifyPreviewStagingDatabaseIdentityDetailed(db, config)).verified;
}

export async function verifyPreviewStagingDatabaseIdentityDetailed(
  db: Pick<DatabaseAdapter, 'engine' | 'queryOne'>,
  config: PreviewStagingDatabaseConfig,
): Promise<PreviewStagingDatabaseIdentityResult> {
  if (db.engine !== 'postgres') {
    return {
      verified: false,
      failureCategory: 'DB_ADAPTER_UNEXPECTED',
      failureStage: 'adapter-construction',
    };
  }

  try {
    const identity = await db.queryOne<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user',
    );
    if (identity?.database_name !== config.databaseName
      || identity.database_user !== PREVIEW_STAGING_DATABASE_SESSION_USER) {
      return {
        verified: false,
        failureCategory: 'DB_IDENTITY_MISMATCH',
        failureStage: 'identity-comparison',
      };
    }
    return { verified: true };
  } catch (error) {
    return {
      verified: false,
      failureCategory: classifyPreviewStagingDatabaseError(error, 'identity-query'),
      failureStage: 'identity-query',
    };
  }
}
