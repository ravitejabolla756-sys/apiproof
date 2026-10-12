import crypto from 'node:crypto';
import {
  loadGitHubAppConfig,
  assertLiveConfig,
  NodeGitHubAppTokenProvider,
  FetchGitHubReadTransport,
  GitHubAppSourceControlProvider,
  getAppInstallationMetadata,
  fetchAllInstallationRepositories,
  getInstallationRepository,
  getVerifierSecret,
  type GitHubRepoItem,
  type GitHubInstallationMetadata,
} from '@apiproof/core';
import { logger } from './logger.js';
import { EXCLUDED_DIRECTORIES } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { getWorkspaceGitHubInstallation, type GitHubInstallationRecord } from './workspace-service.js';

export interface GitHubRepoSummary {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  sha?: string;
  private?: boolean;
}

export function getGitHubAppConfig() {
  return loadGitHubAppConfig();
}

/**
 * Generates the official GitHub App installation URL with a cryptographically bound single-use state token.
 */
export async function getGitHubAppInstallUrl(userId: string, workspaceId: string): Promise<string> {
  const config = loadGitHubAppConfig();
  const slug = config.appSlug || process.env.GITHUB_APP_SLUG || 'apiproof';
  const state = await createGitHubInstallationState(userId, workspaceId);
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}

/**
 * Creates a cryptographically random, signed, single-use state token bound to an authenticated user and workspace.
 */
export async function createGitHubInstallationState(userId: string, workspaceId: string): Promise<string> {
  const nonce = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes TTL
  const payload = `${userId}:${workspaceId}:${expiresAt}:${nonce}`;
  const hmac = crypto.createHmac('sha256', getVerifierSecret()).update(payload).digest('hex');
  const state = `${Buffer.from(payload).toString('base64url')}.${hmac}`;

  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute(`
    INSERT INTO github_installation_states (state, user_id, workspace_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [state, userId, workspaceId, expiresAt, now]);

  return state;
}

/**
 * Verifies and atomically consumes a single-use installation callback state.
 */
export async function verifyAndConsumeGitHubInstallationState(
  state: string,
  userId: string
): Promise<{ valid: boolean; workspaceId?: string; error?: string; errorCode?: string }> {
  if (!state || typeof state !== 'string' || !state.includes('.')) {
    return { valid: false, error: 'Invalid callback state format.', errorCode: 'INVALID_STATE' };
  }

  const [encodedPayload, providedHmac] = state.split('.');
  if (!encodedPayload || !providedHmac) {
    return { valid: false, error: 'Malformed callback state.', errorCode: 'INVALID_STATE' };
  }

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return { valid: false, error: 'Malformed callback state payload.', errorCode: 'INVALID_STATE' };
  }

  const expectedHmac = crypto.createHmac('sha256', getVerifierSecret()).update(payload).digest('hex');
  const providedBuffer = Buffer.from(providedHmac);
  const expectedBuffer = Buffer.from(expectedHmac);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, error: 'Callback state signature verification failed.', errorCode: 'INVALID_STATE' };
  }

  const db = getDatabase();
  const row = await db.queryOne<{
    state: string;
    user_id: string;
    workspace_id: string;
    expires_at: number;
    consumed_at: number | null;
  }>(`
    SELECT state, user_id, workspace_id, expires_at, consumed_at
    FROM github_installation_states
    WHERE state = ?
  `, [state]);

  if (!row) {
    return { valid: false, error: 'Callback state not recognized or expired.', errorCode: 'INVALID_STATE' };
  }

  if (row.consumed_at !== null && row.consumed_at !== undefined) {
    return { valid: false, error: 'Callback state has already been used.', errorCode: 'REUSED_STATE' };
  }

  if (Number(row.expires_at) < Date.now()) {
    return { valid: false, error: 'Callback state has expired.', errorCode: 'EXPIRED_STATE' };
  }

  if (row.user_id !== userId) {
    return { valid: false, error: 'Callback state does not belong to the authenticated user.', errorCode: 'STATE_USER_MISMATCH' };
  }

  // Atomically mark as consumed
  await db.execute(`
    UPDATE github_installation_states
    SET consumed_at = ?
    WHERE state = ?
  `, [Date.now(), state]);

  return { valid: true, workspaceId: row.workspace_id };
}

/** Validate callback state without consuming it for ownership preflight. */
export async function inspectGitHubInstallationState(
  state: string,
  userId?: string
): Promise<{ valid: boolean; userId?: string; workspaceId?: string; error?: string; errorCode?: string }> {
  if (!state || typeof state !== 'string' || !state.includes('.')) {
    return { valid: false, error: 'Invalid callback state format.', errorCode: 'INVALID_STATE' };
  }
  const [encodedPayload, providedHmac] = state.split('.');
  if (!encodedPayload || !providedHmac) {
    return { valid: false, error: 'Malformed callback state.', errorCode: 'INVALID_STATE' };
  }
  let payload: string;
  try { payload = Buffer.from(encodedPayload, 'base64url').toString('utf8'); }
  catch { return { valid: false, error: 'Malformed callback state payload.', errorCode: 'INVALID_STATE' }; }
  const expectedHmac = crypto.createHmac('sha256', getVerifierSecret()).update(payload).digest('hex');
  const providedBuffer = Buffer.from(providedHmac);
  const expectedBuffer = Buffer.from(expectedHmac);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, error: 'Callback state signature verification failed.', errorCode: 'INVALID_STATE' };
  }
  const row = await getDatabase().queryOne<{ workspace_id: string; user_id: string; expires_at: number; consumed_at: number | null }>(
    'SELECT workspace_id, user_id, expires_at, consumed_at FROM github_installation_states WHERE state = ?', [state]);
  if (!row) return { valid: false, error: 'Callback state not recognized or expired.', errorCode: 'INVALID_STATE' };
  if (row.consumed_at !== null && row.consumed_at !== undefined) return { valid: false, error: 'Callback state has already been used.', errorCode: 'REUSED_STATE' };
  if (Number(row.expires_at) < Date.now()) return { valid: false, error: 'Callback state has expired.', errorCode: 'EXPIRED_STATE' };
  if (userId && row.user_id !== userId) {
    return { valid: false, error: 'Callback state does not belong to the authenticated user.', errorCode: 'STATE_USER_MISMATCH' };
  }
  return { valid: true, userId: row.user_id, workspaceId: row.workspace_id };
}

/**
 * Verifies that a GitHub installation belongs to this APIProof GitHub App.
 */
export async function verifyGitHubAppInstallation(
  installationId: string,
  customFetch?: typeof fetch
): Promise<GitHubInstallationMetadata> {
  const config = loadGitHubAppConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!config.appId) {
    throw new Error('GITHUB_CONFIG_MISSING_APP_ID');
  }

  let privateKeyPem: string;
  if (config.privateKey) {
    privateKeyPem = config.privateKey;
  } else if (isProduction) {
    throw new Error('GITHUB_PRIVATE_KEY_UNREADABLE: Production requires GITHUB_APP_PRIVATE_KEY.');
  } else if (config.privateKeyPath) {
    const fs = await import('node:fs/promises');
    privateKeyPem = await fs.readFile(config.privateKeyPath, 'utf8');
  } else {
    throw new Error('GITHUB_PRIVATE_KEY_UNREADABLE');
  }

  return await getAppInstallationMetadata(config.appId, privateKeyPem, installationId, customFetch);
}

/**
 * Fetches all repositories accessible to a workspace's connected GitHub App installation.
 */
export async function fetchWorkspaceRepositories(
  workspaceId: string,
  customFetch?: typeof fetch
): Promise<{
  connected: boolean;
  installation?: GitHubInstallationRecord;
  repositories: GitHubRepoItem[];
}> {
  const installation = await getWorkspaceGitHubInstallation(workspaceId);
  if (!installation) {
    return { connected: false, repositories: [] };
  }

  const config = loadGitHubAppConfig();
  const tokenProvider = new NodeGitHubAppTokenProvider(config, { allowAnyRepository: true });
  const token = await tokenProvider.getInstallationToken(installation.installationId, customFetch);
  const repositories = await fetchAllInstallationRepositories(token, customFetch);

  return {
    connected: true,
    installation,
    repositories,
  };
}

/**
 * Fetches a single repository accessible to a workspace's connected GitHub App installation.
 */
export async function fetchWorkspaceRepository(
  workspaceId: string,
  repositoryId: string,
  customFetch?: typeof fetch
): Promise<GitHubRepoItem> {
  const installation = await getWorkspaceGitHubInstallation(workspaceId);
  if (!installation) {
    throw new Error('NO_GITHUB_INSTALLATION_CONNECTED');
  }

  const config = loadGitHubAppConfig();
  const tokenProvider = new NodeGitHubAppTokenProvider(config, { allowAnyRepository: true });
  const token = await tokenProvider.getInstallationToken(installation.installationId, customFetch);

  return await getInstallationRepository(token, repositoryId, customFetch);
}

export function getGitHubProvider(): GitHubAppSourceControlProvider | null {
  const config = loadGitHubAppConfig();
  if (!config.enabled) {
    return null;
  }
  try {
    assertLiveConfig(config);
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    const transport = new FetchGitHubReadTransport();
    return new GitHubAppSourceControlProvider(config, tokenProvider, transport);
  } catch (error) {
    logger.warn('github_provider_initialization_failed', undefined, error);
    return null;
  }
}

export function createWorkspaceGitHubSourceControlProvider(input: {
  installationId: string;
  repositoryId: string;
  owner: string;
  repository: string;
}): GitHubAppSourceControlProvider {
  const baseConfig = loadGitHubAppConfig();
  const config = { ...baseConfig, ...input };
  assertLiveConfig(config);
  return new GitHubAppSourceControlProvider(
    config,
    new NodeGitHubAppTokenProvider(baseConfig, { allowAnyRepository: true }),
    new FetchGitHubReadTransport(),
  );
}

export async function fetchRemoteRepositoryFiles(
  provider: GitHubAppSourceControlProvider,
  targetSha?: string
): Promise<{ files: Map<string, string>; headSha: string; defaultBranch: string }> {
  const MAX_FILES = 2_000;
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const readWithRetry = async <T>(operation: () => Promise<T>, label: string): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** (attempt - 1)));
        }
      }
    }
    throw new Error(`GITHUB_READ_FAILED:${label}`, { cause: lastError });
  };

  const head = await provider.getDefaultBranch();
  const sha = targetSha ?? head.sha;
  const tree = await readWithRetry(() => provider.readTree(sha), `tree@${sha}`);

  const filesMap = new Map<string, string>();
  const filesToFetch = tree.filter((file) =>
    file === 'package.json' ||
    file === 'pnpm-lock.yaml' ||
    file === 'package-lock.json' ||
    file === 'yarn.lock' ||
    (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(file) &&
      !file.split('/').some((p) => EXCLUDED_DIRECTORIES.has(p) || p.startsWith('.')))
  );

  if (filesToFetch.length > MAX_FILES) {
    throw new Error(`GITHUB_SNAPSHOT_TOO_LARGE: repository contains more than ${MAX_FILES} analyzable files`);
  }

  for (const filePath of filesToFetch) {
    const content = await readWithRetry(() => provider.readFile(filePath, sha), `file:${filePath}@${sha}`);
    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength > MAX_FILE_BYTES) {
      throw new Error(`GITHUB_FILE_TOO_LARGE:${filePath}`);
    }
    if (content.includes('\u0000')) {
      throw new Error(`GITHUB_BINARY_FILE_UNSUPPORTED:${filePath}`);
    }
    filesMap.set(filePath, content);
  }

  return { files: filesMap, headSha: sha, defaultBranch: head.name };
}

export async function getAccessibleRepositoryInfo(): Promise<GitHubRepoSummary | null> {
  const provider = getGitHubProvider();
  if (!provider) return null;

  try {
    const identity = await provider.getRepository();
    const head = await provider.getDefaultBranch();
    return {
      id: identity.repositoryId,
      owner: identity.owner,
      name: identity.repository,
      fullName: `${identity.owner}/${identity.repository}`,
      defaultBranch: head.name,
      sha: head.sha,
    };
  } catch (error) {
    logger.warn('github_accessible_repository_lookup_failed', undefined, error);
    return null;
  }
}
