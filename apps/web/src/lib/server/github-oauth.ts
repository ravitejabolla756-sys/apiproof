import crypto from 'node:crypto';
import { createSessionAsync, hashPassword, type Session, type User } from './auth.js';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { createWorkspaceForUser } from './workspace-service.js';

const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_ENDPOINT = 'https://api.github.com/user';
const GITHUB_EMAILS_ENDPOINT = 'https://api.github.com/user/emails';
const GITHUB_REDIRECT_URI = 'https://www.myowl.dev/api/auth/github/callback';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GITHUB_API_VERSION = '2022-11-28';

export const GITHUB_LOGIN_STATE_COOKIE = 'apiproof_github_login_state';
export const GITHUB_LOGIN_REDIRECT_URI = GITHUB_REDIRECT_URI;

export interface GitHubLoginOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GitHubLoginOAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export interface GitHubLoginIdentity {
  subject: string;
  login: string;
  email: string;
  name: string;
}

export interface GitHubLoginResult {
  kind: 'authenticated' | 'account_exists' | 'created';
  user?: User;
  session?: Session;
}

interface GitHubTokenResponse { access_token?: string; error?: string }
interface GitHubUserResponse { id?: number; login?: string; name?: string | null; email?: string | null }
interface GitHubEmailResponse { email?: string; primary?: boolean; verified?: boolean }
interface GitHubStateRow { return_to: string; code_verifier: string; expires_at: string; consumed_at: string | null }

function hashOpaqueValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function valuesEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(hashOpaqueValue(left), 'hex');
  const rightBuffer = Buffer.from(hashOpaqueValue(right), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  return value.length <= 200 ? value : '/dashboard';
}

export function getGitHubLoginOAuthConfig(env: NodeJS.ProcessEnv = process.env): GitHubLoginOAuthConfig | null {
  const clientId = env.GITHUB_LOGIN_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_LOGIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const redirectUri = env.GITHUB_LOGIN_REDIRECT_URI?.trim() || GITHUB_REDIRECT_URI;
  let parsedRedirect: URL;
  try { parsedRedirect = new URL(redirectUri); } catch { return null; }

  const localDevelopment = parsedRedirect.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(parsedRedirect.hostname)
    && env.NODE_ENV !== 'production';
  if ((parsedRedirect.protocol !== 'https:' && !localDevelopment)
    || parsedRedirect.username || parsedRedirect.password || parsedRedirect.search || parsedRedirect.hash) return null;
  if (env.NODE_ENV === 'production' && redirectUri !== GITHUB_REDIRECT_URI) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createGitHubLoginOAuthState(): GitHubLoginOAuthState {
  const state = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { state, codeVerifier, codeChallenge };
}

export function getGitHubLoginStateCookieOptions(expiresAt?: Date): {
  httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number; expires: Date;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/github',
    maxAge: expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 600,
    expires: expiresAt || new Date(Date.now() + OAUTH_STATE_TTL_MS),
  };
}

export async function persistGitHubLoginOAuthState(state: GitHubLoginOAuthState, returnTo?: string): Promise<void> {
  const now = new Date();
  await getDatabase().execute(`
    INSERT INTO github_login_oauth_states (state_hash, code_verifier, return_to, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [hashOpaqueValue(state.state), state.codeVerifier, safeReturnTo(returnTo), new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString(), now.toISOString()]);
}

export async function consumeGitHubLoginOAuthState(
  state: string,
  cookieState: string | undefined,
): Promise<{ valid: boolean; returnTo?: string; codeVerifier?: string; code?: string }> {
  if (!state || !cookieState || state.length > 200 || cookieState.length > 200) return { valid: false, code: 'OAUTH_STATE_INVALID' };
  if (!valuesEqual(state, cookieState)) return { valid: false, code: 'OAUTH_STATE_MISMATCH' };

  const stateHash = hashOpaqueValue(state);
  return await getDatabase().transaction(async (tx) => {
    const row = await tx.queryOne<GitHubStateRow>(`
      SELECT return_to, code_verifier, expires_at, consumed_at
      FROM github_login_oauth_states WHERE state_hash = ?
    `, [stateHash]);
    if (!row) return { valid: false, code: 'OAUTH_STATE_UNKNOWN' };
    if (row.consumed_at) return { valid: false, code: 'OAUTH_STATE_REPLAYED' };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false, code: 'OAUTH_STATE_EXPIRED' };

    const consumedAt = new Date().toISOString();
    const result = await tx.execute(`
      UPDATE github_login_oauth_states SET consumed_at = ?
      WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?
    `, [consumedAt, stateHash, consumedAt]);
    if (result.changes !== 1) return { valid: false, code: 'OAUTH_STATE_REPLAYED' };
    return { valid: true, returnTo: safeReturnTo(row.return_to), codeVerifier: row.code_verifier };
  });
}

async function exchangeGitHubAuthorizationCode(config: GitHubLoginOAuthConfig, code: string, codeVerifier: string): Promise<string> {
  if (!code || code.length > 2_000 || !codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) throw new Error('GITHUB_OAUTH_CODE_INVALID');
  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: codeVerifier, redirect_uri: config.redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({})) as GitHubTokenResponse;
  if (!response.ok || !payload.access_token) throw new Error(payload.error === 'access_denied' ? 'GITHUB_OAUTH_DENIED' : 'GITHUB_OAUTH_TOKEN_EXCHANGE_FAILED');
  return payload.access_token;
}

async function githubApi<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('GITHUB_OAUTH_PROFILE_FETCH_FAILED');
  return await response.json() as T;
}

async function fetchGitHubIdentity(accessToken: string): Promise<GitHubLoginIdentity> {
  const profile = await githubApi<GitHubUserResponse>(GITHUB_USER_ENDPOINT, accessToken);
  if (!Number.isSafeInteger(profile.id) || profile.id! <= 0 || !profile.login || profile.login.length > 255) throw new Error('GITHUB_OAUTH_PROFILE_INVALID');

  const emails = await githubApi<GitHubEmailResponse[]>(GITHUB_EMAILS_ENDPOINT, accessToken);
  const verifiedEmail = emails.find((entry) => entry.primary && entry.verified)?.email
    || emails.find((entry) => entry.verified)?.email;
  if (!verifiedEmail || !/^\S+@\S+$/.test(verifiedEmail)) throw new Error('GITHUB_OAUTH_EMAIL_UNVERIFIED');

  const email = verifiedEmail.trim().toLowerCase();
  const name = (profile.name || profile.login).trim().slice(0, 100) || profile.login;
  return { subject: String(profile.id), login: profile.login.trim(), email, name };
}

function mapUser(row: { id: string; email: string; name: string; created_at: string }): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

export async function authenticateGitHubLogin(
  config: GitHubLoginOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<GitHubLoginResult> {
  const accessToken = await exchangeGitHubAuthorizationCode(config, code, codeVerifier);
  const identity = await fetchGitHubIdentity(accessToken);
  const result = await getDatabase().transaction(async (tx: DatabaseAdapter): Promise<GitHubLoginResult> => {
    const existingIdentity = await tx.queryOne<{ user_id: string }>('SELECT user_id FROM github_oauth_accounts WHERE github_subject = ?', [identity.subject]);
    if (existingIdentity) {
      const row = await tx.queryOne<{ id: string; email: string; name: string; created_at: string }>('SELECT id, email, name, created_at FROM users WHERE id = ?', [existingIdentity.user_id]);
      if (!row) throw new Error('GITHUB_OAUTH_ACCOUNT_INVALID');
      await tx.execute('UPDATE github_oauth_accounts SET github_login = ?, github_email = ?, github_name = ?, updated_at = ? WHERE github_subject = ?', [identity.login, identity.email, identity.name, new Date().toISOString(), identity.subject]);
      await tx.execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [new Date().toISOString(), existingIdentity.user_id]);
      return { kind: 'authenticated', user: mapUser(row) };
    }

    // A verified GitHub email is not proof that the caller owns an existing
    // MY OWL password account. Explicit linking must be authenticated later.
    const existingEmail = await tx.queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [identity.email]);
    if (existingEmail) return { kind: 'account_exists' };

    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const oauthId = `gho_${crypto.randomBytes(12).toString('hex')}`;
    await tx.execute('INSERT INTO users (id, email, password_hash, name, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', [userId, identity.email, hashPassword(crypto.randomBytes(48).toString('hex')), identity.name, now, now]);
    await createWorkspaceForUser(userId, `${identity.name}'s Workspace`, undefined, tx);
    await tx.execute('INSERT INTO github_oauth_accounts (id, user_id, github_subject, github_login, github_email, github_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [oauthId, userId, identity.subject, identity.login, identity.email, identity.name, now, now]);
    return { kind: 'created', user: { id: userId, email: identity.email, name: identity.name, createdAt: now } };
  });
  if (!result.user) return result;
  return { ...result, session: await createSessionAsync(result.user.id) };
}

export function getGitHubLoginOAuthStateTtlMsForTest(): number { return OAUTH_STATE_TTL_MS; }
