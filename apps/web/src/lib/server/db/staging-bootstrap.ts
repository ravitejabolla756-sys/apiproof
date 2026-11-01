import crypto from 'node:crypto';
import { hashPassword } from '../auth.js';
import type { DatabaseAdapter } from './types.js';

export const STAGING_REPOSITORY = Object.freeze({
  owner: 'ravitejabolla756-sys',
  name: 'my-owl-staging-affected-openai',
  fullName: 'ravitejabolla756-sys/my-owl-staging-affected-openai',
  githubRepositoryId: '1408947921',
  defaultBranch: 'main',
});

export interface StagingBootstrapConfig {
  databaseUrl: string;
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

/**
 * Parse only staging bootstrap inputs. The two exact-literal guards prevent
 * accidental use from a normal migration or a production environment.
 */
export function readStagingBootstrapConfig(environment: NodeJS.ProcessEnv = process.env): StagingBootstrapConfig {
  if (environment.APIPROOF_STAGING_BOOTSTRAP !== 'true') {
    throw new Error('STAGING_BOOTSTRAP_NOT_ENABLED: APIPROOF_STAGING_BOOTSTRAP must equal the literal true');
  }
  if (environment.APIPROOF_SKIP_DEFAULT_SEED !== 'true') {
    throw new Error('STAGING_BOOTSTRAP_REQUIRES_SCHEMA_ONLY: APIPROOF_SKIP_DEFAULT_SEED must equal the literal true');
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
    databaseUrl: required(environment, 'APIPROOF_STAGING_DATABASE_URL'),
    userEmail: required(environment, 'APIPROOF_STAGING_USER_EMAIL').toLowerCase(),
    userPassword: required(environment, 'APIPROOF_STAGING_USER_PASSWORD'),
    userName: required(environment, 'APIPROOF_STAGING_USER_NAME'),
    githubInstallationId,
    githubAccountLogin,
  };
}

interface ExistingCounts {
  users: number;
  workspaces: number;
  members: number;
  installations: number;
  repositories: number;
  activityEvents: number;
  scans: number;
  findings: number;
}

async function counts(db: DatabaseAdapter): Promise<ExistingCounts> {
  const tableCounts = await Promise.all([
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM users'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM workspaces'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM workspace_members'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM github_installations'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM repositories'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM activity_events'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM scans'),
    db.queryOne<{ count: number | string }>('SELECT COUNT(*) AS count FROM findings'),
  ]);
  return {
    users: Number(tableCounts[0]?.count ?? 0),
    workspaces: Number(tableCounts[1]?.count ?? 0),
    members: Number(tableCounts[2]?.count ?? 0),
    installations: Number(tableCounts[3]?.count ?? 0),
    repositories: Number(tableCounts[4]?.count ?? 0),
    activityEvents: Number(tableCounts[5]?.count ?? 0),
    scans: Number(tableCounts[6]?.count ?? 0),
    findings: Number(tableCounts[7]?.count ?? 0),
  };
}

function isEmpty(countsValue: ExistingCounts): boolean {
  return Object.values(countsValue).every((value) => value === 0);
}

function isExpectedBootstrapShape(countsValue: ExistingCounts): boolean {
  return countsValue.users === 1 && countsValue.workspaces === 1 && countsValue.members === 1
    && countsValue.installations === 1 && countsValue.repositories === 1
    && countsValue.activityEvents === 0 && countsValue.scans === 0 && countsValue.findings === 0;
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
      'SELECT owner, name, github_repository_id, default_branch FROM repositories LIMIT 1'
    );
    const existingInstall = await db.queryOne<{ account_login: string; installation_id: string }>(
      'SELECT account_login, installation_id FROM github_installations LIMIT 1'
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
      [userId, config.userEmail, hashPassword(config.userPassword), config.userName, now]
    );
    await tx.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, `${config.userName}'s Workspace`, 'my-owl-staging', now, now]
    );
    await tx.execute(
      "INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      [memberId, workspaceId, userId, now]
    );
    await tx.execute(
      'INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [installationRowId, workspaceId, config.githubInstallationId, config.githubAccountLogin, 'Organization', 'active', now, now]
    );
    await tx.execute(
      "INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)",
      [repositoryId, workspaceId, userId, STAGING_REPOSITORY.owner, STAGING_REPOSITORY.name, STAGING_REPOSITORY.fullName, STAGING_REPOSITORY.githubRepositoryId, STAGING_REPOSITORY.defaultBranch, now]
    );
  });

  return { created: true, repository: STAGING_REPOSITORY, counts: await counts(db) };
}
