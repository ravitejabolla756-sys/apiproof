import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';

export type WorkspaceRole = 'owner' | 'member';
export type RepositoryOrigin = 'connected' | 'seeded_fixture' | 'imported';
export type RepositoryLifecycle = 'active' | 'historical' | 'disconnected';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

export interface GitHubInstallationRecord {
  id: string;
  workspaceId: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryRecord {
  id: string;
  workspace_id: string;
  user_id?: string | undefined;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
  status: string;
  origin: RepositoryOrigin;
  lifecycle: RepositoryLifecycle;
  last_scan_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface FindingRecord {
  id: string;
  scan_id: string;
  repository_id: string;
  usage_id: string;
  change_id: string;
  provider: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  file_path: string;
  line_number: number;
  symbol: string;
  status: string;
  reason: string;
  reason_codes: string;
  evidence: string;
  source_snippet: string | null;
  source_digest?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface MigrationRecord {
  id: string;
  finding_id: string;
  repository_id: string;
  plan_id: string;
  status: string;
  plan_json: string;
  patch_diff: string;
  patch_digest: string;
  patch_content?: string | null;
  baseline_sha?: string | null;
  verification_report: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface PullRequestRecord {
  id: string;
  migration_id: string;
  repository_id: string;
  number: number;
  title: string;
  branch_name: string;
  base_branch: string;
  url: string;
  state: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Creates a workspace for a user with the 'owner' role.
 * Can accept an optional transaction runner for atomic signups.
 */
export async function createWorkspaceForUser(
  userId: string,
  workspaceName: string,
  customSlug?: string,
  tx?: DatabaseAdapter
): Promise<WorkspaceWithRole> {
  const runner = tx || getDatabase();
  const workspaceId = `ws_${crypto.randomBytes(10).toString('hex')}`;
  const memberId = `wsm_${crypto.randomBytes(10).toString('hex')}`;
  const now = new Date().toISOString();

  let slug = customSlug
    ? customSlug.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
    : `${workspaceName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;

  // Fallback if slug becomes empty
  if (!slug || slug.length === 0) {
    slug = `workspace-${crypto.randomBytes(4).toString('hex')}`;
  }

  await runner.execute(`
    INSERT INTO workspaces (id, name, slug, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, [workspaceId, workspaceName.trim(), slug, now, now]);

  await runner.execute(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
    VALUES (?, ?, ?, 'owner', ?)
  `, [memberId, workspaceId, userId, now]);

  return {
    id: workspaceId,
    name: workspaceName.trim(),
    slug,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns all workspaces the user belongs to with their role.
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  const db = getDatabase();
  const rows = await db.query<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
    role: WorkspaceRole;
  }>(`
    SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?
    ORDER BY CASE wm.role WHEN 'owner' THEN 1 ELSE 2 END, w.created_at ASC
  `, [userId]);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Resolves the primary/default workspace for the user.
 * If user has no workspace (e.g. fresh DB before migration), creates one automatically.
 */
export async function getDefaultWorkspaceForUser(userId: string): Promise<WorkspaceWithRole> {
  const workspaces = await getUserWorkspaces(userId);
  if (workspaces.length > 0) {
    return workspaces[0]!;
  }

  // Fetch user name for workspace naming
  const db = getDatabase();
  const user = await db.queryOne<{ name: string; email: string }>('SELECT name, email FROM users WHERE id = ?', [userId]);
  const wsName = user?.name ? `${user.name}'s Workspace` : 'Default Workspace';
  const emailPrefix = user?.email ? user.email.split('@')[0] : 'team';
  const customSlug = `${emailPrefix}-${crypto.randomBytes(3).toString('hex')}`;

  return await createWorkspaceForUser(userId, wsName, customSlug);
}

/**
 * Enforces that a user is a member of the given workspace.
 */
export async function requireWorkspaceMember(userId: string, workspaceId: string): Promise<WorkspaceWithRole> {
  const db = getDatabase();
  const row = await db.queryOne<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
    role: WorkspaceRole;
  }>(`
    SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ?
  `, [workspaceId, userId]);

  if (!row) {
    throw new Error('Workspace not found or access denied.');
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Enforces that a user is an owner of the given workspace.
 */
export async function requireWorkspaceOwner(userId: string, workspaceId: string): Promise<WorkspaceWithRole> {
  const workspace = await requireWorkspaceMember(userId, workspaceId);
  if (workspace.role !== 'owner') {
    throw new Error('Action requires workspace owner privileges.');
  }
  return workspace;
}

/**
 * Central repository authorization boundary:
 * Resolves repository (by ID, full_name, or name) and verifies membership
 * in repository.workspace_id.
 */
export async function requireRepositoryAccess(
  repositoryIdOrSlug: string,
  userId: string
): Promise<{
  repository: RepositoryRecord;
  workspace: WorkspaceWithRole;
}> {
  const db = getDatabase();
  const row = await db.queryOne<{
    id: string;
    workspace_id: string;
    user_id?: string;
    owner: string;
    name: string;
    full_name: string;
    github_repository_id: string;
    default_branch: string;
    status: string;
    origin: RepositoryOrigin;
    lifecycle: RepositoryLifecycle;
    last_scan_at: string | null;
    created_at: string;
    workspace_name: string;
    workspace_slug: string;
    workspace_created_at: string;
    workspace_updated_at: string;
    member_role: WorkspaceRole;
  }>(`
    SELECT r.*,
           w.name as workspace_name, w.slug as workspace_slug,
           w.created_at as workspace_created_at, w.updated_at as workspace_updated_at,
           wm.role as member_role
    FROM repositories r
    JOIN workspaces w ON w.id = r.workspace_id
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE (r.id = ? OR r.name = ? OR r.full_name = ?)
      AND wm.user_id = ?
      AND r.lifecycle = 'active'
  `, [repositoryIdOrSlug, repositoryIdOrSlug, repositoryIdOrSlug, userId]);

  if (!row) {
    // Legacy migration compatibility: if workspace_id is not yet set on a legacy row,
    // verify the row belonged to this user, backfill their default workspace, and authorize.
    const legacyRow = await db.queryOne<{
      id: string;
      workspace_id: string | null;
      user_id?: string;
      owner: string;
      name: string;
      full_name: string;
      github_repository_id: string;
      default_branch: string;
      status: string;
      origin: RepositoryOrigin;
      lifecycle: RepositoryLifecycle;
      last_scan_at: string | null;
      created_at: string;
    }>(`
      SELECT * FROM repositories
      WHERE (id = ? OR name = ? OR full_name = ?)
        AND (workspace_id IS NULL OR workspace_id = '')
        AND user_id = ?
        AND (lifecycle = 'active' OR lifecycle IS NULL)
    `, [repositoryIdOrSlug, repositoryIdOrSlug, repositoryIdOrSlug, userId]);

    if (legacyRow) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('Repository not found or access denied. Legacy repository identity is not eligible for production access.');
      }
      const defaultWs = await getDefaultWorkspaceForUser(userId);
      await db.execute('UPDATE repositories SET workspace_id = ? WHERE id = ?', [defaultWs.id, legacyRow.id]);
      return {
        repository: {
          ...legacyRow,
          workspace_id: defaultWs.id,
          origin: legacyRow.origin ?? 'connected',
          lifecycle: legacyRow.lifecycle ?? 'active',
        },
        workspace: defaultWs,
      };
    }
  }

  if (!row) {
    throw new Error('Repository not found or access denied.');
  }
  if (process.env.NODE_ENV !== 'test' && row.origin !== 'connected') throw new Error('Repository not found or access denied. Historical or synthetic identity is not eligible for live access.');

  return {
    repository: {
      id: row.id,
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      owner: row.owner,
      name: row.name,
      full_name: row.full_name,
      github_repository_id: row.github_repository_id,
      default_branch: row.default_branch,
      status: row.status,
      origin: row.origin,
      lifecycle: row.lifecycle,
      last_scan_at: row.last_scan_at,
      created_at: row.created_at,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      slug: row.workspace_slug,
      role: row.member_role,
      createdAt: row.workspace_created_at,
      updatedAt: row.workspace_updated_at,
    },
  };
}

/**
 * Central finding authorization boundary:
 * Resolves finding -> repository -> workspace -> membership.
 */
export async function requireFindingAccess(
  findingId: string,
  userId: string
): Promise<{
  finding: FindingRecord;
  repository: RepositoryRecord;
  workspace: WorkspaceWithRole;
}> {
  const db = getDatabase();
  const finding = await db.queryOne<FindingRecord>(`
    SELECT * FROM findings WHERE id = ? OR change_id = ?
  `, [findingId, findingId]);

  if (!finding) {
    throw new Error('Finding not found or access denied.');
  }

  const { repository, workspace } = await requireRepositoryAccess(finding.repository_id, userId);

  return {
    finding,
    repository,
    workspace,
  };
}

/**
 * Central migration authorization boundary:
 * Resolves migration -> repository -> workspace -> membership.
 */
export async function requireMigrationAccess(
  migrationId: string,
  userId: string
): Promise<{
  migration: MigrationRecord;
  repository: RepositoryRecord;
  workspace: WorkspaceWithRole;
}> {
  const db = getDatabase();
  const migration = await db.queryOne<MigrationRecord>(`
    SELECT * FROM migrations WHERE id = ?
  `, [migrationId]);

  if (!migration) {
    throw new Error('Migration not found or access denied.');
  }

  const { repository, workspace } = await requireRepositoryAccess(migration.repository_id, userId);

  return {
    migration,
    repository,
    workspace,
  };
}

/**
 * Central pull request authorization boundary:
 * Resolves pull request -> migration -> repository -> workspace -> membership.
 */
export async function requirePullRequestAccess(
  pullRequestId: string,
  userId: string
): Promise<{
  pullRequest: PullRequestRecord;
  repository: RepositoryRecord;
  workspace: WorkspaceWithRole;
}> {
  const db = getDatabase();
  const pullRequest = await db.queryOne<PullRequestRecord>(`
    SELECT * FROM pull_requests WHERE id = ?
  `, [pullRequestId]);

  if (!pullRequest) {
    throw new Error('Pull request not found or access denied.');
  }

  const { repository, workspace } = await requireRepositoryAccess(pullRequest.repository_id, userId);

  return {
    pullRequest,
    repository,
    workspace,
  };
}

/**
 * Queries GitHub installation metadata belonging to a workspace.
 */
export async function getWorkspaceGitHubInstallation(
  workspaceId: string,
  options?: { includeInactive?: boolean }
): Promise<GitHubInstallationRecord | null> {
  const db = getDatabase();
  const filterInactive = !options?.includeInactive;
  const whereClause = filterInactive
    ? "WHERE workspace_id = ? AND (status IS NULL OR status = 'active')"
    : 'WHERE workspace_id = ?';
  const row = await db.queryOne<{
    id: string;
    workspace_id: string;
    installation_id: string;
    account_login: string;
    account_type: string;
    status: string | null;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at
    FROM github_installations
    ${whereClause}
    LIMIT 1
  `, [workspaceId]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    installationId: row.installation_id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    status: (row.status as 'active' | 'suspended' | 'deleted') || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Queries GitHub installation metadata by installation ID.
 */
export async function getGitHubInstallationByInstallationId(
  installationId: string,
  options?: { includeInactive?: boolean }
): Promise<GitHubInstallationRecord | null> {
  const db = getDatabase();
  const filterInactive = !options?.includeInactive;
  const whereClause = filterInactive
    ? "WHERE installation_id = ? AND (status IS NULL OR status = 'active')"
    : 'WHERE installation_id = ?';
  const row = await db.queryOne<{
    id: string;
    workspace_id: string;
    installation_id: string;
    account_login: string;
    account_type: string;
    status: string | null;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at
    FROM github_installations
    ${whereClause}
    LIMIT 1
  `, [installationId]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    installationId: row.installation_id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    status: (row.status as 'active' | 'suspended' | 'deleted') || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Updates status of a GitHub installation record.
 */
export async function updateGitHubInstallationStatus(
  installationId: string,
  status: 'active' | 'suspended' | 'deleted'
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute(`
    UPDATE github_installations
    SET status = ?, updated_at = ?
    WHERE installation_id = ?
  `, [status, now, installationId]);
}
