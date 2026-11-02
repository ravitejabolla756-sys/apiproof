import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, getDatabase, initDatabase, SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { SQLITE_SCHEMA } from '../apps/web/src/lib/server/db/schema.js';
import { githubLoginMigrations } from '../apps/web/src/lib/server/db/github-login-migration.js';
import {
  authenticateGitHubLogin,
  consumeGitHubLoginOAuthState,
  createGitHubLoginOAuthState,
  getGitHubLoginOAuthConfig,
  getGitHubLoginStateCookieOptions,
  getGitHubLoginOAuthStateTtlMsForTest,
  GITHUB_LOGIN_REDIRECT_URI,
  persistGitHubLoginOAuthState,
} from '../apps/web/src/lib/server/github-oauth.js';
import { GET as startGitHubLogin } from '../apps/web/src/app/api/auth/github/start/route.js';
import { GET as completeGitHubLogin } from '../apps/web/src/app/api/auth/github/callback/route.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';

const dbPath = path.join(os.tmpdir(), `apiproof-github-oauth-${process.pid}.db`);
const clientId = 'github-login-client-id';
const clientSecret = 'server-only-github-login-client-secret';
const testVerifier = 'v'.repeat(43);

function mockGitHubFetch(options: { tokenError?: boolean; unverifiedEmail?: boolean } = {}): void {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') {
      const body = new URLSearchParams(String(init?.body || ''));
      if (options.tokenError || body.get('code_verifier') !== testVerifier) return new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 400 });
      return new Response(JSON.stringify({ access_token: 'github-access-token', token_type: 'bearer', scope: 'read:user,user:email' }), { status: 200 });
    }
    if (url === 'https://api.github.com/user') {
      return new Response(JSON.stringify({ id: 123456, login: 'octocat', name: 'Octo Cat', email: null }), { status: 200 });
    }
    if (url === 'https://api.github.com/user/emails') {
      return new Response(JSON.stringify([{ email: 'octo@example.com', primary: true, verified: !options.unverifiedEmail }]), { status: 200 });
    }
    throw new Error(`Unexpected GitHub URL: ${url}`);
  }));
}

async function seedState(returnTo = '/dashboard'): Promise<ReturnType<typeof createGitHubLoginOAuthState>> {
  const state = createGitHubLoginOAuthState();
  await persistGitHubLoginOAuthState({ ...state, codeVerifier: testVerifier }, returnTo);
  return state;
}

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.APIPROOF_DB_PATH = dbPath;
  process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
  process.env.GITHUB_LOGIN_CLIENT_ID = clientId;
  process.env.GITHUB_LOGIN_CLIENT_SECRET = clientSecret;
  resetRateLimits();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  initDatabase(dbPath);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  delete process.env.APIPROOF_DB_PATH;
  delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  delete process.env.GITHUB_LOGIN_CLIENT_ID;
  delete process.env.GITHUB_LOGIN_CLIENT_SECRET;
  delete process.env.GITHUB_LOGIN_REDIRECT_URI;
});

describe('GitHub Login OAuth', () => {
  it('uses the separate Login OAuth App with PKCE, minimal scopes, and the canonical callback', async () => {
    const response = await startGitHubLogin(new Request('https://www.myowl.dev/api/auth/github/start?next=/dashboard', { headers: { 'x-forwarded-for': '203.0.113.20' } }));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') || '');
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(location.searchParams.get('redirect_uri')).toBe(GITHUB_LOGIN_REDIRECT_URI);
    expect(location.searchParams.get('scope')).toBe('read:user user:email');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('creates a user, workspace, GitHub identity, and existing session', async () => {
    const state = await seedState('/dashboard');
    mockGitHubFetch();
    const response = await completeGitHubLogin(new Request(`https://www.myowl.dev/api/auth/github/callback?code=one-time-code&state=${state.state}`, { headers: { cookie: `apiproof_github_login_state=${state.state}` } }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') || '').pathname).toBe('/onboarding');
    expect(response.headers.get('set-cookie')).toContain('apiproof_session=ses_');
    const user = await getDatabase().queryOne<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = ?', ['octo@example.com']);
    expect(user?.id).toMatch(/^usr_/);
    expect(await getDatabase().queryOne('SELECT github_subject FROM github_oauth_accounts WHERE user_id = ?', [user?.id])).toMatchObject({ github_subject: '123456' });
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM workspace_members WHERE user_id = ?', [user?.id])).toHaveLength(1);
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM sessions WHERE user_id = ?', [user?.id])).toHaveLength(1);
  });

  it('rejects invalid state before contacting GitHub and leaves state unconsumed', async () => {
    const state = await seedState();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await completeGitHubLogin(new Request(`https://www.myowl.dev/api/auth/github/callback?code=code&state=${state.state}`, { headers: { cookie: 'apiproof_github_login_state=attacker-state' } }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') || '').searchParams.get('github')).toBe('github_oauth_state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT consumed_at FROM github_login_oauth_states WHERE state_hash = ?', [crypto.createHash('sha256').update(state.state).digest('hex')])).toMatchObject({ consumed_at: null });
  });

  it('expires and replays state safely, and uses secure production cookies', async () => {
    const expiredState = await seedState();
    await getDatabase().execute('UPDATE github_login_oauth_states SET expires_at = ? WHERE state_hash = ?', [new Date(Date.now() - getGitHubLoginOAuthStateTtlMsForTest()).toISOString(), crypto.createHash('sha256').update(expiredState.state).digest('hex')]);
    await expect(consumeGitHubLoginOAuthState(expiredState.state, expiredState.state)).resolves.toMatchObject({ valid: false, code: 'OAUTH_STATE_EXPIRED' });

    const liveState = await seedState();
    await expect(consumeGitHubLoginOAuthState(liveState.state, liveState.state)).resolves.toMatchObject({ valid: true });
    await expect(consumeGitHubLoginOAuthState(liveState.state, liveState.state)).resolves.toMatchObject({ valid: false, code: 'OAUTH_STATE_REPLAYED' });

    process.env.NODE_ENV = 'production';
    expect(getGitHubLoginStateCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/github' });
    process.env.NODE_ENV = 'test';
  });

  it('rejects existing email accounts instead of automatically linking them', async () => {
    createUser('octo@example.com', 'ExistingPassword123!', 'Existing User');
    mockGitHubFetch();
    const config = getGitHubLoginOAuthConfig({ NODE_ENV: 'test', GITHUB_LOGIN_CLIENT_ID: clientId, GITHUB_LOGIN_CLIENT_SECRET: clientSecret });
    await expect(authenticateGitHubLogin(config!, 'code', testVerifier)).resolves.toEqual({ kind: 'account_exists' });
    expect(await getDatabase().queryOne('SELECT id FROM github_oauth_accounts')).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions')).toBeUndefined();
  });

  it('authenticates a previously linked subject without creating another workspace', async () => {
    mockGitHubFetch();
    const config = getGitHubLoginOAuthConfig({ NODE_ENV: 'test', GITHUB_LOGIN_CLIENT_ID: clientId, GITHUB_LOGIN_CLIENT_SECRET: clientSecret });
    await expect(authenticateGitHubLogin(config!, 'code', testVerifier)).resolves.toMatchObject({ kind: 'created' });
    await expect(authenticateGitHubLogin(config!, 'code', testVerifier)).resolves.toMatchObject({ kind: 'authenticated' });
    expect(await getDatabase().query<{ user_id: string }>('SELECT user_id FROM workspace_members')).toHaveLength(1);
    expect(await getDatabase().query('SELECT id FROM github_oauth_accounts')).toHaveLength(1);
  });

  it('fails closed on token, profile, and email verification errors', async () => {
    const config = getGitHubLoginOAuthConfig({ NODE_ENV: 'test', GITHUB_LOGIN_CLIENT_ID: clientId, GITHUB_LOGIN_CLIENT_SECRET: clientSecret });
    mockGitHubFetch({ tokenError: true });
    await expect(authenticateGitHubLogin(config!, 'code', testVerifier)).rejects.toThrow('GITHUB_OAUTH_TOKEN_EXCHANGE_FAILED');
    mockGitHubFetch({ unverifiedEmail: true });
    await expect(authenticateGitHubLogin(config!, 'code', testVerifier)).rejects.toThrow('GITHUB_OAUTH_EMAIL_UNVERIFIED');
    expect(await getDatabase().queryOne('SELECT id FROM users')).toBeUndefined();
  });

  it('upgrades migration 023 idempotently, rolls back partial DDL, and enforces identity uniqueness', async () => {
    const legacyDb = new DatabaseSync(':memory:');
    try {
      legacyDb.exec(SQLITE_SCHEMA);
      const adapter = new SqliteDatabaseAdapter(legacyDb);
      const migration = githubLoginMigrations[0]!;
      await migration.up(adapter);
      await migration.up(adapter);
      await adapter.execute('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)', ['usr_one', 'one@example.com', 'hash', 'One', new Date().toISOString()]);
      await adapter.execute('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)', ['usr_two', 'two@example.com', 'hash', 'Two', new Date().toISOString()]);
      const account = ['gho_one', 'usr_one', '123', 'octo', 'one@example.com', 'One', new Date().toISOString(), new Date().toISOString()];
      await adapter.execute('INSERT INTO github_oauth_accounts (id, user_id, github_subject, github_login, github_email, github_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', account);
      await expect(adapter.execute('INSERT INTO github_oauth_accounts (id, user_id, github_subject, github_login, github_email, github_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['gho_subject_duplicate', 'usr_two', '123', 'other', 'two@example.com', 'Two', new Date().toISOString(), new Date().toISOString()])).rejects.toThrow(/UNIQUE/);
      await expect(adapter.execute('INSERT INTO github_oauth_accounts (id, user_id, github_subject, github_login, github_email, github_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['gho_user_duplicate', 'usr_one', '456', 'other', 'one@example.com', 'One', new Date().toISOString(), new Date().toISOString()])).rejects.toThrow(/UNIQUE/);
    } finally {
      legacyDb.close();
    }

    const rollbackDb = new DatabaseSync(':memory:');
    try {
      rollbackDb.exec(SQLITE_SCHEMA);
      const adapter = new SqliteDatabaseAdapter(rollbackDb);
      const migration = githubLoginMigrations[0]!;
      await expect(adapter.transaction(async (tx) => {
        await migration.up(tx);
        throw new Error('intentional migration rollback');
      })).rejects.toThrow('intentional migration rollback');
      expect(await adapter.queryOne('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'github_oauth_accounts'])).toBeUndefined();
    } finally {
      rollbackDb.close();
    }
  });
});
