import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import { requireWorkspaceCapability } from './workspace-service.js';
import { encryptSlackToken, getSlackOAuthConfig, hashSlackOpaqueValue } from './slack-security.js';

const OAUTH_STATE_TTL_MS = 15 * 60_000;
const REQUIRED_BOT_SCOPES = new Set(['chat:write', 'im:write']);

export async function createSlackAuthorizationUrl(userId: string, workspaceId: string): Promise<string> {
  const config = getSlackOAuthConfig();
  // Validate encryption configuration before redirecting the user into an OAuth flow.
  encryptSlackToken('configuration-check');
  const workspace = await requireWorkspaceCapability(userId, workspaceId, 'integration:manage');
  const state = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await getDatabase().execute(`INSERT INTO slack_oauth_states
    (id, state_hash, workspace_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  [`sls_${crypto.randomBytes(12).toString('hex')}`, hashSlackOpaqueValue(state), workspace.id, userId,
    new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString(), now.toISOString()]);
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', 'chat:write,im:write');
  url.searchParams.set('state', state);
  return url.toString();
}

export interface SlackOAuthConnection {
  teamId: string;
  teamName: string;
  installerSlackUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export async function consumeSlackOAuthState(state: string, userId: string): Promise<{ workspaceId: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(state)) return null;
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const row = await tx.queryOne<{ id: string; workspace_id: string; user_id: string; expires_at: string }>(`
      SELECT id, workspace_id, user_id, expires_at FROM slack_oauth_states
      WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?`, [hashSlackOpaqueValue(state), now]);
    if (!row || row.user_id !== userId) return null;
    const consumed = await tx.execute('UPDATE slack_oauth_states SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ?', [now, row.id, now]);
    return consumed.changes === 1 ? { workspaceId: row.workspace_id } : null;
  });
}

export async function exchangeSlackOAuthCode(code: string): Promise<SlackOAuthConnection> {
  if (!code || code.length > 4096) throw new Error('SLACK_OAUTH_CODE_INVALID');
  const config = getSlackOAuthConfig();
  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST', headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: config.redirectUri }), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`SLACK_OAUTH_HTTP_${response.status}`);
  const result = await response.json() as {
    ok?: boolean; error?: string; access_token?: string; token_type?: string; scope?: string;
    expires_in?: number; refresh_token?: string;
    team?: { id?: string; name?: string };
    authed_user?: { id?: string };
  };
  if (!result.ok) throw new Error(`SLACK_OAUTH_${(result.error ?? 'FAILED').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80)}`);
  const scopes = new Set((result.scope ?? '').split(',').map((scope) => scope.trim()).filter(Boolean));
  if ([...REQUIRED_BOT_SCOPES].some((scope) => !scopes.has(scope))) throw new Error('SLACK_REQUIRED_BOT_SCOPES_MISSING');
  if (result.token_type !== 'bot' || typeof result.access_token !== 'string' || !/^(xoxb-|xoxe\.xoxb-)/.test(result.access_token)
    || result.access_token.length > 4096 || typeof result.team?.id !== 'string' || !result.team.id
    || typeof result.team.name !== 'string' || !result.team.name
    || typeof result.authed_user?.id !== 'string' || !result.authed_user.id
    || (result.expires_in !== undefined && (!Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 || result.expires_in > 31_536_000))
    || (result.refresh_token !== undefined && (typeof result.refresh_token !== 'string' || !result.refresh_token))
    || (result.expires_in !== undefined && !result.refresh_token)) {
    throw new Error('SLACK_OAUTH_RESPONSE_INVALID');
  }
  const expiresIn = result.expires_in;
  return {
    teamId: result.team.id,
    teamName: result.team.name.slice(0, 200),
    installerSlackUserId: result.authed_user.id,
    accessToken: result.access_token,
    ...(result.refresh_token ? { refreshToken: result.refresh_token } : {}),
    ...(typeof expiresIn === 'number' && expiresIn > 0 ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
  };
}

export async function saveSlackConnection(input: SlackOAuthConnection, workspaceId: string, userId: string): Promise<void> {
  await requireWorkspaceCapability(userId, workspaceId, 'integration:manage');
  const encrypted = encryptSlackToken(JSON.stringify({ accessToken: input.accessToken, refreshToken: input.refreshToken, expiresAt: input.expiresAt }));
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute(`INSERT INTO slack_connections
    (id, workspace_id, team_id, team_name, installer_slack_user_id, connected_by, token_ciphertext, token_iv, token_auth_tag, status, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET team_id = excluded.team_id, team_name = excluded.team_name,
      installer_slack_user_id = excluded.installer_slack_user_id, connected_by = excluded.connected_by,
      token_ciphertext = excluded.token_ciphertext, token_iv = excluded.token_iv, token_auth_tag = excluded.token_auth_tag,
      status = 'active', connected_at = excluded.connected_at, updated_at = excluded.updated_at`,
  [`slc_${crypto.randomBytes(12).toString('hex')}`, workspaceId, input.teamId, input.teamName, input.installerSlackUserId, userId,
    encrypted.ciphertext, encrypted.iv, encrypted.authTag, now, now]);
}
