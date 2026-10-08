import crypto from 'node:crypto';
import { hashPassword } from '../auth.js';
import type { DatabaseAdapter } from './types.js';
import {
  PREVIEW_STAGING_DATABASE_NAME,
  PREVIEW_STAGING_DATABASE_URL_USERNAME,
} from './preview-isolation.js';

export const STAGING_REPOSITORY = Object.freeze({
  owner: 'ravitejabolla756-sys',
  name: 'my-owl-staging-affected-openai',
  fullName: 'ravitejabolla756-sys/my-owl-staging-affected-openai',
  githubRepositoryId: '1408947921',
  defaultBranch: 'main',
});

export const STAGING_DATABASE_URL_USERNAME = PREVIEW_STAGING_DATABASE_URL_USERNAME;
export const STAGING_DATABASE_SESSION_USER = 'postgres';
export const STAGING_DATABASE_NAME = PREVIEW_STAGING_DATABASE_NAME;

export interface StagingBootstrapConfig {
  databaseUrl: string;
  databaseUrlUsername: string;
  databaseSessionUser: string;
  databaseName: string;
  userEmail: string;
  userPassword: string;
  userName: string;
  githubInstallationId: string;
  githubAccountLogin: string;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`MISSING_STAGING_BOOTSTRAP_INPUT: ${name}`);
  return value;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('INVALID_STAGING_DATABASE_URL: encoded database identity is malformed');
  }
}

function parseStagingDatabaseUrl(databaseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('INVALID_STAGING_DATABASE_URL: expected a PostgreSQL connection URL');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('INVALID_STAGING_DATABASE_URL: expected a PostgreSQL connection URL');
  }
  if (!parsed.hostname.endsWith('.supabase.com') && !parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('INVALID_STAGING_DATABASE_URL: staging must target a Supabase PostgreSQL host');
  }
  if (!parsed.username || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('INVALID_STAGING_DATABASE_URL: database username and name are required');
  }
  return parsed;
}

/**
 * Parse only staging inputs. Generic DATABASE_URL variables are rejected so
 * this workflow cannot silently inherit a production target.
 */
export function readStagingBootstrapConfig(environment: NodeJS.ProcessEnv = process.env): StagingBootstrapConfig {
  if (environment.APIPROOF_STAGING_BOOTSTRAP !== 'true') {
    throw new Error('STAGING_BOOTSTRAP_NOT_ENABLED: APIPROOF_STAGING_BOOTSTRAP must equal the literal true');
  }
  if (environment.APIPROOF_SKIP_DEFAULT_SEED !== 'true') {
    throw new Error('STAGING_BOOTSTRAP_REQUIRES_SCHEMA_ONLY: APIPROOF_SKIP_DEFAULT_SEED must equal the literal true');
  }
  if (environment.DATABASE_URL?.trim() || environment.APIPROOF_DATABASE_URL?.trim()) {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: generic database variables must be unset');
  }

  const databaseUrl = required(environment, 'APIPROOF_STAGING_DATABASE_URL');
  const parsed = parseStagingDatabaseUrl(databaseUrl);
  const expectedUrlUsername = required(environment, 'APIPROOF_STAGING_EXPECTED_URL_USERNAME');
  const expectedDatabaseName = required(environment, 'APIPROOF_STAGING_EXPECTED_DB_NAME');
  const urlUser = decode(parsed.username);
  const urlDatabase = decode(parsed.pathname.slice(1));
  if (expectedUrlUsername !== STAGING_DATABASE_URL_USERNAME || urlUser !== STAGING_DATABASE_URL_USERNAME) {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: URL username does not match the exact staging project identity');
  }
  if (expectedDatabaseName !== STAGING_DATABASE_NAME || urlDatabase !== STAGING_DATABASE_NAME) {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: URL database name does not match the expected staging identity');
  }

  const githubAccountLogin = required(environment, 'APIPROOF_STAGING_GITHUB_ACCOUNT_LOGIN');
  if (githubAccountLogin !== STAGING_REPOSITORY.owner) {
    throw new Error('INVALID_STAGING_GITHUB_ACCOUNT: bootstrap is restricted to the controlled staging owner');
  }

  const githubInstallationId = required(environment, 'APIPROOF_STAGING_GITHUB_INSTALLATION_ID');
  if (!/^\d+$/.test(githubInstallationId)) {
    throw new Error('INVALID_STAGING_INSTALLATION_ID: expected a numeric GitHub installation id');
  }

  return {
    databaseUrl,
    databaseUrlUsername: urlUser,
    databaseSessionUser: STAGING_DATABASE_SESSION_USER,
    databaseName: STAGING_DATABASE_NAME,
    userEmail: required(environment, 'APIPROOF_STAGING_USER_EMAIL').toLowerCase(),
    userPassword: required(environment, 'APIPROOF_STAGING_USER_PASSWORD'),
    userName: required(environment, 'APIPROOF_STAGING_USER_NAME'),
    githubInstallationId,
    githubAccountLogin,
  };
}

export async function verifyStagingDatabaseIdentity(
  db: DatabaseAdapter,
  config: StagingBootstrapConfig,
): Promise<void> {
  if (db.engine !== 'postgres') {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: staging bootstrap requires PostgreSQL');
  }
  const identity = await db.queryOne<{ database_name: string; database_user: string }>(
    'SELECT current_database() AS database_name, current_user AS database_user',
  );
  if (!identity || identity.database_name !== config.databaseName || identity.database_user !== config.databaseSessionUser) {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: connected database identity does not match the expected staging identity');
  }
}

interface ExistingCounts {
  users: number;
  workspaces: number;
  members: number;
  installations: number;
  repositories: number;
  activityEvents: number;
  sessions: number;
  passwordResetTokens: number;
  scans: number;
  findings: number;
  migrations: number;
  pullRequests: number;
  rateLimits: number;
  webhookDeliveries: number;
  scanRequests: number;
  installationStates: number;
  workspaceSubscriptions: number;
  workspaceUsage: number;
  billingWebhookEvents: number;
  slackConnections: number;
  slackOauthStates: number;
  slackNotificationDeliveries: number;
  slackActionTokens: number;
  slackNotificationDismissals: number;
  slackInteractionJobs: number;
  verificationJobs: number;
  verificationWorkers: number;
}

const EMPTY_APPLICATION_TABLES = [
  ['users', 'users'],
  ['workspaces', 'workspaces'],
  ['workspace_members', 'members'],
  ['github_installations', 'installations'],
  ['repositories', 'repositories'],
  ['activity_events', 'activityEvents'],
  ['sessions', 'sessions'],
  ['password_reset_tokens', 'passwordResetTokens'],
  ['scans', 'scans'],
  ['findings', 'findings'],
  ['migrations', 'migrations'],
  ['pull_requests', 'pullRequests'],
  ['rate_limits', 'rateLimits'],
  ['github_webhook_deliveries', 'webhookDeliveries'],
  ['github_scan_requests', 'scanRequests'],
  ['github_installation_states', 'installationStates'],
  ['workspace_subscriptions', 'workspaceSubscriptions'],
  ['workspace_usage', 'workspaceUsage'],
  ['billing_webhook_events', 'billingWebhookEvents'],
  ['slack_connections', 'slackConnections'],
  ['slack_oauth_states', 'slackOauthStates'],
  ['slack_notification_deliveries', 'slackNotificationDeliveries'],
  ['slack_action_tokens', 'slackActionTokens'],
  ['slack_notification_dismissals', 'slackNotificationDismissals'],
  ['slack_interaction_jobs', 'slackInteractionJobs'],
  ['migration_verification_jobs', 'verificationJobs'],
  ['migration_verification_workers', 'verificationWorkers'],
] as const;

async function counts(db: DatabaseAdapter): Promise<ExistingCounts> {
  const rows = await Promise.all(EMPTY_APPLICATION_TABLES.map(([table, key]) =>
    db.queryOne<{ count: number | string }>(`SELECT COUNT(*) AS count FROM ${table}`).then((row) => [key, Number(row?.count ?? 0)] as const)));
  return Object.fromEntries(rows) as unknown as ExistingCounts;
}

function isEmpty(value: ExistingCounts): boolean {
  return Object.values(value).every((count) => count === 0);
}

function isExpectedBootstrapShape(value: ExistingCounts): boolean {
  return value.users === 1 && value.workspaces === 1 && value.members === 1
    && value.installations === 1 && value.repositories === 1
    && Object.entries(value).every(([key, count]) =>
      ['users', 'workspaces', 'members', 'installations', 'repositories'].includes(key) || count === 0);
}

export interface StagingBootstrapResult {
  created: boolean;
  repository: typeof STAGING_REPOSITORY;
  counts: ExistingCounts;
}

/** Insert only the controlled staging identity and repository, transactionally. */
export async function bootstrapStagingDatabase(
  db: DatabaseAdapter,
  config: StagingBootstrapConfig,
): Promise<StagingBootstrapResult> {
  const before = await counts(db);
  if (!isEmpty(before) && !isExpectedBootstrapShape(before)) {
    throw new Error('STAGING_BOOTSTRAP_REFUSED: target database contains unexpected records');
  }
  if (!isEmpty(before)) {
    const existingRepo = await db.queryOne<{ owner: string; name: string; github_repository_id: string; default_branch: string }>(
      'SELECT owner, name, github_repository_id, default_branch FROM repositories LIMIT 1',
    );
    const existingInstall = await db.queryOne<{ account_login: string; installation_id: string }>(
      'SELECT account_login, installation_id FROM github_installations LIMIT 1',
    );
    if (!existingRepo || existingRepo.owner !== STAGING_REPOSITORY.owner || existingRepo.name !== STAGING_REPOSITORY.name
      || existingRepo.github_repository_id !== STAGING_REPOSITORY.githubRepositoryId
      || existingRepo.default_branch !== STAGING_REPOSITORY.defaultBranch
      || !existingInstall || existingInstall.account_login !== config.githubAccountLogin
      || existingInstall.installation_id !== config.githubInstallationId) {
      throw new Error('STAGING_BOOTSTRAP_REFUSED: existing records do not match the controlled staging fixture');
    }
    return { created: false, repository: STAGING_REPOSITORY, counts: before };
  }

  const now = new Date().toISOString();
  const userId = `usr_staging_${crypto.randomBytes(12).toString('hex')}`;
  const workspaceId = `ws_staging_${crypto.randomBytes(10).toString('hex')}`;
  const memberId = `wsm_staging_${crypto.randomBytes(10).toString('hex')}`;
  const installationRowId = `inst_staging_${crypto.randomBytes(10).toString('hex')}`;
  const repositoryId = `repo_staging_${crypto.randomBytes(10).toString('hex')}`;

  await db.transaction(async (tx) => {
    await tx.execute(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, config.userEmail, hashPassword(config.userPassword), config.userName, now],
    );
    await tx.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, `${config.userName}'s Workspace`, 'my-owl-staging', now, now],
    );
    await tx.execute(
      "INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      [memberId, workspaceId, userId, now],
    );
    await tx.execute(
      'INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [installationRowId, workspaceId, config.githubInstallationId, config.githubAccountLogin, 'Organization', 'active', now, now],
    );
    await tx.execute(
      "INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)",
      [repositoryId, workspaceId, userId, STAGING_REPOSITORY.owner, STAGING_REPOSITORY.name, STAGING_REPOSITORY.fullName, STAGING_REPOSITORY.githubRepositoryId, STAGING_REPOSITORY.defaultBranch, now],
    );
  });

  return { created: true, repository: STAGING_REPOSITORY, counts: await counts(db) };
}
