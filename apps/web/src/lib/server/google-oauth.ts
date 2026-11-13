import crypto from 'node:crypto';
import { createSessionAsync, hashPassword, type Session, type User } from './auth.js';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { createWorkspaceForUser } from './workspace-service.js';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_REDIRECT_URI = 'https://www.myowl.dev/api/auth/google/callback';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_CLOCK_SKEW_SECONDS = 60;

export const GOOGLE_OAUTH_STATE_COOKIE = 'apiproof_google_oauth_state';
export const GOOGLE_OAUTH_REDIRECT_URI = GOOGLE_REDIRECT_URI;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleOAuthState {
  state: string;
  codeVerifier: string;
  nonce: string;
  codeChallenge: string;
}

export interface GoogleOAuthIdentity {
  subject: string;
  email: string;
  name: string;
}

export interface GoogleOAuthResult {
  kind: 'authenticated' | 'account_exists' | 'created';
  user?: User;
  session?: Session;
}

interface GoogleIdTokenHeader { alg?: string; kid?: string; typ?: string }
interface GoogleIdTokenClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  exp?: number;
  iat?: number;
}
interface GoogleJsonWebKey { kty?: string; kid?: string; alg?: string; use?: string; n?: string; e?: string }
interface GoogleJwksResponse { keys?: GoogleJsonWebKey[] }
interface GoogleTokenResponse { id_token?: string; error?: string }
interface GoogleStateRow {
  return_to: string;
  code_verifier: string;
  nonce: string;
  expires_at: string;
  consumed_at: string | null;
}

let googleJwksCache: { keys: GoogleJsonWebKey[]; expiresAt: number } | null = null;

export function getGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || GOOGLE_REDIRECT_URI;
  let parsedRedirect: URL;
  try { parsedRedirect = new URL(redirectUri); } catch { return null; }

  const localDevelopment = parsedRedirect.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(parsedRedirect.hostname)
    && env.NODE_ENV !== 'production';
  if ((parsedRedirect.protocol !== 'https:' && !localDevelopment)
    || parsedRedirect.username || parsedRedirect.password || parsedRedirect.search || parsedRedirect.hash) return null;
  if (env.NODE_ENV === 'production' && redirectUri !== GOOGLE_REDIRECT_URI) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createGoogleOAuthState(): GoogleOAuthState {
  const state = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { state, codeVerifier, nonce, codeChallenge };
}

function hashOpaqueValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  return value.length <= 200 ? value : '/dashboard';
}

function valuesEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(hashOpaqueValue(left), 'hex');
  const rightBuffer = Buffer.from(hashOpaqueValue(right), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function persistGoogleOAuthState(state: GoogleOAuthState, returnTo?: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString();
  await getDatabase().execute(`
    INSERT INTO google_oauth_states (state_hash, code_verifier, nonce, return_to, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [hashOpaqueValue(state.state), state.codeVerifier, state.nonce, safeReturnTo(returnTo), expiresAt, now.toISOString()]);
}

export async function consumeGoogleOAuthState(
  state: string,
  cookieState: string | undefined,
): Promise<{ valid: boolean; returnTo?: string; codeVerifier?: string; nonce?: string; code?: string }> {
  if (!state || !cookieState || state.length > 200 || cookieState.length > 200) return { valid: false, code: 'OAUTH_STATE_INVALID' };
  if (!valuesEqual(state, cookieState)) return { valid: false, code: 'OAUTH_STATE_MISMATCH' };

  const stateHash = hashOpaqueValue(state);
  return await getDatabase().transaction(async (tx) => {
    const row = await tx.queryOne<GoogleStateRow>(`
      SELECT return_to, code_verifier, nonce, expires_at, consumed_at
      FROM google_oauth_states WHERE state_hash = ?
    `, [stateHash]);
    if (!row) return { valid: false, code: 'OAUTH_STATE_UNKNOWN' };
    if (row.consumed_at) return { valid: false, code: 'OAUTH_STATE_REPLAYED' };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false, code: 'OAUTH_STATE_EXPIRED' };

    const consumedAt = new Date().toISOString();
    const result = await tx.execute(`
      UPDATE google_oauth_states SET consumed_at = ?
      WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?
    `, [consumedAt, stateHash, consumedAt]);
    if (result.changes !== 1) return { valid: false, code: 'OAUTH_STATE_REPLAYED' };
    return { valid: true, returnTo: safeReturnTo(row.return_to), codeVerifier: row.code_verifier, nonce: row.nonce };
  });
}

export function getGoogleOAuthStateCookieOptions(expiresAt?: Date): {
  httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number; expires: Date;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 600,
    expires: expiresAt || new Date(Date.now() + OAUTH_STATE_TTL_MS),
  };
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function assertValidTokenSegment(value: string, field: string): void {
  if (!value || value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`GOOGLE_ID_TOKEN_${field.toUpperCase()}_INVALID`);
}

function parseCacheMaxAge(value: string | null): number {
  const match = value?.match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match?.[1] ? Number(match[1]) : 3600;
  return Number.isSafeInteger(seconds) ? Math.min(Math.max(seconds, 300), 86_400) : 3600;
}

async function fetchGoogleJwks(forceRefresh = false): Promise<GoogleJsonWebKey[]> {
  if (!forceRefresh && googleJwksCache && googleJwksCache.expiresAt > Date.now()) return googleJwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_ENDPOINT, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('GOOGLE_JWKS_UNAVAILABLE');
  const payload = await response.json() as GoogleJwksResponse;
  const keys = (payload.keys || []).filter((key) => key.kty === 'RSA' && key.kid && key.n && key.e && (!key.alg || key.alg === 'RS256'));
  if (keys.length === 0) throw new Error('GOOGLE_JWKS_INVALID');
  googleJwksCache = { keys, expiresAt: Date.now() + parseCacheMaxAge(response.headers.get('cache-control')) * 1000 };
  return keys;
}

export async function verifyGoogleIdToken(idToken: string, config: GoogleOAuthConfig, expectedNonce: string): Promise<GoogleOAuthIdentity> {
  if (!idToken || idToken.length > 16_384) throw new Error('GOOGLE_ID_TOKEN_INVALID');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('GOOGLE_ID_TOKEN_INVALID');
  parts.forEach((part, index) => assertValidTokenSegment(part, ['header', 'payload', 'signature'][index] || 'segment'));

  let header: GoogleIdTokenHeader;
  let claims: GoogleIdTokenClaims;
  try {
    header = decodeJson<GoogleIdTokenHeader>(parts[0]!);
    claims = decodeJson<GoogleIdTokenClaims>(parts[1]!);
  } catch { throw new Error('GOOGLE_ID_TOKEN_INVALID'); }
  if (header.alg !== 'RS256' || !header.kid || (header.typ && header.typ !== 'JWT')) throw new Error('GOOGLE_ID_TOKEN_INVALID');

  let jwk = (await fetchGoogleJwks()).find((key) => key.kid === header.kid);
  if (!jwk) jwk = (await fetchGoogleJwks(true)).find((key) => key.kid === header.kid);
  if (!jwk?.n || !jwk.e) throw new Error('GOOGLE_ID_TOKEN_KEY_UNKNOWN');

  try {
    const publicKey = crypto.createPublicKey({ key: jwk as never, format: 'jwk' });
    const signatureValid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2]!, 'base64url'));
    if (!signatureValid) throw new Error('GOOGLE_ID_TOKEN_SIGNATURE_INVALID');
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_ID_TOKEN_SIGNATURE_INVALID') throw error;
    throw new Error('GOOGLE_ID_TOKEN_SIGNATURE_INVALID', { cause: error });
  }

  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const claimsValid = !!claims.iss
    && ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
    && audience.includes(config.clientId)
    && (!claims.azp || claims.azp === config.clientId)
    && (audience.length <= 1 || claims.azp === config.clientId)
    && !!claims.sub && claims.sub.length <= 255
    && !!claims.email && /^\S+@\S+$/.test(claims.email)
    && claims.email_verified === true
    && claims.nonce === expectedNonce
    && Number.isSafeInteger(claims.exp) && claims.exp! > now - TOKEN_CLOCK_SKEW_SECONDS
    && Number.isSafeInteger(claims.iat) && claims.iat! <= now + TOKEN_CLOCK_SKEW_SECONDS;
  if (!claimsValid) throw new Error('GOOGLE_ID_TOKEN_CLAIMS_INVALID');

  const email = claims.email!.trim().toLowerCase();
  const name = (claims.name || email.split('@')[0] || 'Google user').trim().slice(0, 100) || 'Google user';
  return { subject: claims.sub!, email, name };
}

async function exchangeGoogleAuthorizationCode(config: GoogleOAuthConfig, code: string, codeVerifier: string): Promise<string> {
  if (!code || code.length > 2_000 || !codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) throw new Error('GOOGLE_OAUTH_CODE_INVALID');
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: codeVerifier, grant_type: 'authorization_code', redirect_uri: config.redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.id_token) throw new Error(payload.error === 'access_denied' ? 'GOOGLE_OAUTH_DENIED' : 'GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED');
  return payload.id_token;
}

function mapUser(row: { id: string; email: string; name: string; created_at: string }): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

export async function authenticateGoogleOAuth(config: GoogleOAuthConfig, code: string, codeVerifier: string, expectedNonce: string): Promise<GoogleOAuthResult> {
  const idToken = await exchangeGoogleAuthorizationCode(config, code, codeVerifier);
  const identity = await verifyGoogleIdToken(idToken, config, expectedNonce);
  const result = await getDatabase().transaction(async (tx: DatabaseAdapter): Promise<GoogleOAuthResult> => {
    const existingIdentity = await tx.queryOne<{ user_id: string }>('SELECT user_id FROM google_oauth_accounts WHERE google_subject = ?', [identity.subject]);
    if (existingIdentity) {
      const row = await tx.queryOne<{ id: string; email: string; name: string; created_at: string }>('SELECT id, email, name, created_at FROM users WHERE id = ?', [existingIdentity.user_id]);
      if (!row) throw new Error('GOOGLE_OAUTH_ACCOUNT_INVALID');
      await tx.execute('UPDATE google_oauth_accounts SET google_email = ?, google_name = ?, updated_at = ? WHERE google_subject = ?', [identity.email, identity.name, new Date().toISOString(), identity.subject]);
      return { kind: 'authenticated', user: mapUser(row) };
    }

    // A matching email is not proof that the caller owns the existing account.
    // Explicit account linking must happen later from an authenticated session.
    const existingEmail = await tx.queryOne<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?)', [identity.email]);
    if (existingEmail) return { kind: 'account_exists' };

    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const oauthId = `goa_${crypto.randomBytes(12).toString('hex')}`;
    const displayName = identity.name;
    await tx.execute('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)', [userId, identity.email, hashPassword(crypto.randomBytes(48).toString('hex')), displayName, now]);
    await createWorkspaceForUser(userId, `${displayName}'s Workspace`, undefined, tx);
    await tx.execute('INSERT INTO google_oauth_accounts (id, user_id, google_subject, google_email, google_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [oauthId, userId, identity.subject, identity.email, displayName, now, now]);
    return { kind: 'created', user: { id: userId, email: identity.email, name: displayName, createdAt: now } };
  });
  if (!result.user) return result;
  return { ...result, session: await createSessionAsync(result.user.id) };
}

export function resetGoogleJwksCacheForTest(): void { googleJwksCache = null; }
export function getGoogleOAuthStateTtlMsForTest(): number { return OAUTH_STATE_TTL_MS; }
