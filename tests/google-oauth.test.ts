import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, getDatabase, initDatabase, SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { SQLITE_SCHEMA } from '../apps/web/src/lib/server/db/schema.js';
import { googleOAuthMigrations } from '../apps/web/src/lib/server/db/google-oauth-migration.js';
import {
  authenticateGoogleOAuth,
  consumeGoogleOAuthState,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_REDIRECT_URI,
  persistGoogleOAuthState,
  resetGoogleJwksCacheForTest,
  getGoogleOAuthStateTtlMsForTest,
  verifyGoogleIdToken,
} from '../apps/web/src/lib/server/google-oauth.js';
import { GET as startGoogleOAuth } from '../apps/web/src/app/api/auth/google/start/route.js';
import { GET as completeGoogleOAuth } from '../apps/web/src/app/api/auth/google/callback/route.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';

const dbPath = path.join(os.tmpdir(), `apiproof-google-oauth-${process.pid}.db`);
const clientId = 'google-client-id.apps.googleusercontent.com';
const clientSecret = 'server-only-google-client-secret';
const testVerifier = 'v'.repeat(43);
const environmentKeys = ['NODE_ENV', 'APIPROOF_DB_PATH', 'APIPROOF_SKIP_DEFAULT_SEED', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'];
const savedEnvironment = new Map<string, string | undefined>();
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeIdToken(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const payload = encode({
    iss: 'https://accounts.google.com', aud: clientId, sub: 'google-subject-123',
    email: 'google-user@example.com', email_verified: true, name: 'Google User',
    nonce: 'expected-nonce', iat: now, exp: now + 300, ...overrides,
  });
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`;
}

function mockGoogleFetch(idToken = makeIdToken()): void {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      const body = new URLSearchParams(String(init?.body || ''));
      if (body.get('code_verifier') !== testVerifier) return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      return new Response(JSON.stringify({ id_token: idToken, token_type: 'Bearer' }), { status: 200 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }), { status: 200, headers: { 'cache-control': 'public, max-age=3600' } });
    }
    throw new Error(`Unexpected Google URL: ${url}`);
  }));
}

async function seedState(returnTo = '/dashboard'): Promise<ReturnType<typeof createGoogleOAuthState>> {
  const state = createGoogleOAuthState();
  await persistGoogleOAuthState({ ...state, codeVerifier: testVerifier, nonce: 'expected-nonce' }, returnTo);
  return state;
}

beforeEach(() => {
  for (const key of environmentKeys) savedEnvironment.set(key, process.env[key]);
  process.env.NODE_ENV = 'test';
  process.env.APIPROOF_DB_PATH = dbPath;
  process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
  process.env.GOOGLE_OAUTH_CLIENT_ID = clientId;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = clientSecret;
  resetRateLimits();
  resetGoogleJwksCacheForTest();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  initDatabase(dbPath);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetGoogleJwksCacheForTest();
  await closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  for (const key of environmentKeys) {
    const saved = savedEnvironment.get(key);
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
    savedEnvironment.delete(key);
  }
});

describe('Google OAuth 2.0 sign-in', () => {
  it('builds a PKCE request with minimal scopes and a secure state cookie', async () => {
    const response = await startGoogleOAuth(new Request('https://myowl.dev/api/auth/google/start?next=/dashboard', { headers: { 'x-forwarded-for': '203.0.113.10' } }));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') || '');
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('redirect_uri')).toBe(GOOGLE_OAUTH_REDIRECT_URI);
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('samesite=lax');
  });

  it('creates a user, workspace, provider identity, and existing session', async () => {
    const state = await seedState('/dashboard');
    mockGoogleFetch();
    const response = await completeGoogleOAuth(new Request(`https://myowl.dev/api/auth/google/callback?code=one-time-code&state=${state.state}`, { headers: { cookie: `apiproof_google_oauth_state=${state.state}` } }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') || '').pathname).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('apiproof_session=ses_');
    const user = await getDatabase().queryOne<{ id: string; email: string; email_verified_at: string | null }>('SELECT id, email, email_verified_at FROM users WHERE email = ?', ['google-user@example.com']);
    expect(user?.id).toMatch(/^usr_/);
    expect(user?.email_verified_at).toBeTruthy();
    expect(await getDatabase().queryOne('SELECT google_subject FROM google_oauth_accounts WHERE user_id = ?', [user?.id])).toMatchObject({ google_subject: 'google-subject-123' });
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM workspace_members WHERE user_id = ?', [user?.id])).toHaveLength(1);
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM sessions WHERE user_id = ?', [user?.id])).toHaveLength(1);
  });

  it('rejects invalid state before contacting Google and leaves state unconsumed', async () => {
    const state = await seedState();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await completeGoogleOAuth(new Request(`https://myowl.dev/api/auth/google/callback?code=code&state=${state.state}`, { headers: { cookie: 'apiproof_google_oauth_state=attacker-state' } }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') || '').searchParams.get('google')).toBe('google_oauth_state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT consumed_at FROM google_oauth_states WHERE state_hash = ?', [crypto.createHash('sha256').update(state.state).digest('hex')])).toMatchObject({ consumed_at: null });
  });

  it('expires and consumes OAuth state exactly once, with secure production cookie settings', async () => {
    const expiredState = await seedState();
    await getDatabase().execute('UPDATE google_oauth_states SET expires_at = ? WHERE state_hash = ?', [new Date(Date.now() - getGoogleOAuthStateTtlMsForTest()).toISOString(), crypto.createHash('sha256').update(expiredState.state).digest('hex')]);
    await expect(consumeGoogleOAuthState(expiredState.state, expiredState.state)).resolves.toMatchObject({ valid: false, code: 'OAUTH_STATE_EXPIRED' });

    const liveState = await seedState();
    await expect(consumeGoogleOAuthState(liveState.state, liveState.state)).resolves.toMatchObject({ valid: true });
    await expect(consumeGoogleOAuthState(liveState.state, liveState.state)).resolves.toMatchObject({ valid: false, code: 'OAUTH_STATE_REPLAYED' });

    process.env.NODE_ENV = 'production';
    const cookie = getGoogleOAuthStateCookieOptions();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/google' });
    process.env.NODE_ENV = 'test';
  });

  it('fails closed when the persisted OAuth state expiry is malformed', async () => {
    const state = await seedState();
    const stateHash = crypto.createHash('sha256').update(state.state).digest('hex');
    await getDatabase().execute('UPDATE google_oauth_states SET expires_at = ? WHERE state_hash = ?', ['not-a-timestamp', stateHash]);

    await expect(consumeGoogleOAuthState(state.state, state.state)).resolves.toMatchObject({ valid: false, code: 'OAUTH_STATE_EXPIRED' });
    expect(await getDatabase().queryOne<{ consumed_at: string | null }>('SELECT consumed_at FROM google_oauth_states WHERE state_hash = ?', [stateHash])).toMatchObject({ consumed_at: null });
  });

  it('prunes expired transient states when persisting a new login attempt', async () => {
    const expired = await seedState();
    const expiredHash = crypto.createHash('sha256').update(expired.state).digest('hex');
    await getDatabase().execute('UPDATE google_oauth_states SET expires_at = ? WHERE state_hash = ?', [new Date(Date.now() - 1_000).toISOString(), expiredHash]);
    const active = await seedState();
    const activeHash = crypto.createHash('sha256').update(active.state).digest('hex');

    await expect(getDatabase().queryOne('SELECT state_hash FROM google_oauth_states WHERE state_hash = ?', [expiredHash])).resolves.toBeUndefined();
    await expect(getDatabase().queryOne('SELECT state_hash FROM google_oauth_states WHERE state_hash = ?', [activeHash])).resolves.toMatchObject({ state_hash: activeHash });
  });

  it('limits expired-state pruning to one bounded batch per login attempt', async () => {
    const expiredCount = 1_001;
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const createdAt = new Date(Date.now() - 120_000).toISOString();
    const values = Array.from({ length: expiredCount }, (_, index) => [
      `expired-test-state-${String(index).padStart(4, '0')}`,
      testVerifier,
      'expected-nonce',
      '/dashboard',
      expiredAt,
      null,
      createdAt,
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await getDatabase().execute(
      `INSERT INTO google_oauth_states (state_hash, code_verifier, nonce, return_to, expires_at, consumed_at, created_at) VALUES ${placeholders}`,
      values.flat(),
    );

    const active = await seedState();
    const activeHash = crypto.createHash('sha256').update(active.state).digest('hex');

    await expect(getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM google_oauth_states WHERE expires_at <= ?',
      [new Date().toISOString()],
    )).resolves.toMatchObject({ count: 1 });
    await expect(getDatabase().queryOne('SELECT state_hash FROM google_oauth_states WHERE state_hash = ?', [activeHash])).resolves.toMatchObject({ state_hash: activeHash });
  });

  it('rejects invalid claims and signatures before account creation', async () => {
    const config = getGoogleOAuthConfig({ NODE_ENV: 'test', GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret });
    expect(config).not.toBeNull();
    mockGoogleFetch(makeIdToken({ aud: 'another-client-id' }));
    await expect(authenticateGoogleOAuth(config!, 'code', testVerifier, 'expected-nonce')).rejects.toThrow('GOOGLE_ID_TOKEN_CLAIMS_INVALID');
    resetGoogleJwksCacheForTest();
    mockGoogleFetch(`${makeIdToken().slice(0, -10)}invalidsig`);
    await expect(authenticateGoogleOAuth(config!, 'code', testVerifier, 'expected-nonce')).rejects.toThrow('GOOGLE_ID_TOKEN_SIGNATURE_INVALID');
    expect(await getDatabase().queryOne('SELECT id FROM google_oauth_accounts')).toBeUndefined();
  });

  it('rejects an existing email instead of linking accounts automatically', async () => {
    createUser('google-user@example.com', 'ExistingPassword123!', 'Existing User');
    mockGoogleFetch();
    const config = getGoogleOAuthConfig({ NODE_ENV: 'test', GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret });
    await expect(authenticateGoogleOAuth(config!, 'code', testVerifier, 'expected-nonce')).resolves.toEqual({ kind: 'account_exists' });
    expect(await getDatabase().queryOne('SELECT id FROM google_oauth_accounts')).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions')).toBeUndefined();
  });

  it('allows a previously linked subject to sign in and pins production redirects', async () => {
    mockGoogleFetch();
    const config = getGoogleOAuthConfig({ NODE_ENV: 'test', GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret });
    await expect(authenticateGoogleOAuth(config!, 'code', testVerifier, 'expected-nonce')).resolves.toMatchObject({ kind: 'created' });
    mockGoogleFetch(makeIdToken({ email: 'changed@example.com', name: 'Updated Google User' }));
    await expect(authenticateGoogleOAuth(config!, 'code', testVerifier, 'expected-nonce')).resolves.toMatchObject({ kind: 'authenticated' });
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM workspace_members')).toHaveLength(1);
    await expect(verifyGoogleIdToken(makeIdToken({ nonce: 'wrong-nonce' }), config!, 'expected-nonce')).rejects.toThrow('GOOGLE_ID_TOKEN_CLAIMS_INVALID');
    expect(getGoogleOAuthConfig({ NODE_ENV: 'production', GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret, GOOGLE_OAUTH_REDIRECT_URI: 'https://evil.example/callback' })).toBeNull();
  });

  it('upgrades an existing SQLite schema idempotently and enforces identity uniqueness', async () => {
    const legacyDb = new DatabaseSync(':memory:');
    try {
      legacyDb.exec(SQLITE_SCHEMA);
      const adapter = new SqliteDatabaseAdapter(legacyDb);
      const migration = googleOAuthMigrations[0]!;
      await migration.up(adapter);
      await migration.up(adapter);

      expect(await adapter.queryOne('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'google_oauth_accounts'])).toMatchObject({ name: 'google_oauth_accounts' });
      await adapter.execute('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)', ['usr_one', 'one@example.com', 'hash', 'One', new Date().toISOString()]);
      await adapter.execute('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)', ['usr_two', 'two@example.com', 'hash', 'Two', new Date().toISOString()]);
      const account = ['goa_one', 'usr_one', 'google-subject-one', 'one@example.com', 'One', new Date().toISOString(), new Date().toISOString()];
      await adapter.execute('INSERT INTO google_oauth_accounts (id, user_id, google_subject, google_email, google_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', account);

      await expect(adapter.execute('INSERT INTO google_oauth_accounts (id, user_id, google_subject, google_email, google_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['goa_subject_duplicate', 'usr_two', 'google-subject-one', 'two@example.com', 'Two', new Date().toISOString(), new Date().toISOString()])).rejects.toThrow(/UNIQUE/);
      await expect(adapter.execute('INSERT INTO google_oauth_accounts (id, user_id, google_subject, google_email, google_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['goa_user_duplicate', 'usr_one', 'google-subject-two', 'one@example.com', 'One', new Date().toISOString(), new Date().toISOString()])).rejects.toThrow(/UNIQUE/);
    } finally {
      legacyDb.close();
    }
  });

  it('rolls back a partial 022 migration instead of leaving half-created tables', async () => {
    const rollbackDb = new DatabaseSync(':memory:');
    try {
      rollbackDb.exec(SQLITE_SCHEMA);
      const adapter = new SqliteDatabaseAdapter(rollbackDb);
      const migration = googleOAuthMigrations[0]!;
      await expect(adapter.transaction(async (tx) => {
        await migration.up(tx);
        throw new Error('intentional migration rollback');
      })).rejects.toThrow('intentional migration rollback');
      expect(await adapter.queryOne('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'google_oauth_accounts'])).toBeUndefined();
      await migration.up(adapter);
      expect(await adapter.queryOne('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'google_oauth_accounts'])).toMatchObject({ name: 'google_oauth_accounts' });
    } finally {
      rollbackDb.close();
    }
  });
});
