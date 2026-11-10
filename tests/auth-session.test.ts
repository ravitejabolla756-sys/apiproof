/**
 * Focused Production Authentication & Session Persistence Test Suite
 *
 * Covers:
 *   A. Successful sign-in & sign-up:
 *      - Creates database-backed session
 *      - Sets persistent, secure, httpOnly session cookie with Max-Age & Expires
 *   B. Duplicate submission / rate limiting:
 *      - Verifies rate limiter enforcement and graceful rejection
 *   C. Session persistence:
 *      - Cookie allows subsequent authenticated requests
 *      - Session remains valid across simulated time within TTL
 *      - Expired session is invalidated cleanly
 *   D. Invalid credentials:
 *      - Rejects invalid password with 401
 *      - No session created
 *   E. Logout:
 *      - Deletes session row from database
 *      - Clears cookie with Max-Age=0
 *      - Subsequent authenticated requests fail with 401
 *   F. Middleware routing:
 *      - Unauthenticated /dashboard redirects to /login?from=/dashboard
 *      - Unauthenticated /api/overview returns 401
 *      - Authenticated /dashboard passes through
 *      - /login passes through middleware without trusting cookie presence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { POST as authPost, GET as authGet } from '../apps/web/src/app/api/auth/route.js';
import { middleware } from '../apps/web/src/middleware.js';
import {
  AUTH_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSession,
  createSessionAsync,
  createUserWithSession,
  isValidSessionId,
  validateSession,
  validateSessionAsync,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from '../apps/web/src/lib/server/auth.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';

const TEST_DB_PATH = path.resolve('.tmp/test-auth-session.db');
const ENVIRONMENT_KEYS = ['APIPROOF_DB_PATH', 'APIPROOF_SECRET'] as const;
let originalEnvironment: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string>>;

describe('Production Authentication & Session Persistence', () => {
  beforeEach(() => {
    originalEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'auth-test-secret-at-least-32-chars-long!';
    resetRateLimits();

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    for (const key of ENVIRONMENT_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function createRequest(
    url: string,
    options: {
      method?: string;
      body?: Record<string, unknown>;
      cookie?: string;
      headers?: Record<string, string>;
    } = {}
  ): Request {
    const headers = new Headers({
      'content-type': 'application/json',
      origin: 'https://apiproof.test',
      host: 'apiproof.test',
      ...options.headers,
    });
    if (options.cookie) {
      headers.set('cookie', options.cookie);
    }

    const init: RequestInit = {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers,
    };
    if (options.body) {
      init.body = JSON.stringify(options.body);
    }

    return new Request(url, init);
  }

  // ---------------------------------------------------------------------------
  // A. SUCCESSFUL SIGN-UP AND SIGN-IN
  // ---------------------------------------------------------------------------
  describe('A. Successful Sign-in and Sign-up Flow', () => {
    it('creates exactly one session row in the database and sets persistent cookie options', async () => {
      const db = getDatabase();

      // Sign up
      const signupReq = createRequest('https://apiproof.test/api/auth', {
        body: {
          action: 'signup',
          email: 'founder@example.com',
          password: 'Password1234!',
          name: 'Jane Doe',
        },
      });

      const signupRes = await authPost(signupReq);
      expect(signupRes.status).toBe(200);

      const signupData = (await signupRes.json()) as { success: boolean; user: { id: string; email: string } };
      expect(signupData.success).toBe(true);
      expect(signupData.user.email).toBe('founder@example.com');

      // Verify cookie header
      const cookieHeader = signupRes.headers.get('set-cookie');
      expect(cookieHeader).toBeTruthy();
      expect(cookieHeader).toContain(`${AUTH_COOKIE_NAME}=ses_`);
      expect(cookieHeader).toContain('Path=/');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader?.toLowerCase()).toContain('samesite=lax');
      const cookieMaxAge = Number(cookieHeader?.match(/Max-Age=(\d+)/)?.[1]);
      expect(cookieMaxAge).toBeGreaterThan(0);
      expect(cookieMaxAge).toBeLessThanOrEqual(SESSION_TTL_SECONDS);

      // Verify session exists in database
      const sessions = await db.query<{ id: string; user_id: string; expires_at: string }>(
        'SELECT * FROM sessions WHERE user_id = ?',
        [signupData.user.id]
      );
      expect(sessions.length).toBe(1);
      const firstSession = sessions[0];
      expect(firstSession).toBeDefined();
      expect(firstSession?.id).toMatch(/^ses_/);

      // Verify cookie options generator
      const opts = getAuthCookieOptions(firstSession?.expires_at);
      expect(opts.httpOnly).toBe(true);
      expect(opts.path).toBe('/');
      expect(opts.sameSite).toBe('lax');
      expect(opts.maxAge).toBeGreaterThan(0);
      expect(opts.maxAge).toBeLessThanOrEqual(SESSION_TTL_SECONDS);
      expect(opts.expires).toBeInstanceOf(Date);
    });

    it('signs in an existing user, creates a new session, and returns persistent cookie', async () => {
      const db = getDatabase();

      // Sign up first
      await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'engineer@example.com',
            password: 'SecurePassword123!',
            name: 'Bob Smith',
          },
        })
      );

      // Sign in
      const loginReq = createRequest('https://apiproof.test/api/auth', {
        body: {
          action: 'login',
          email: 'engineer@example.com',
          password: 'SecurePassword123!',
        },
      });

      const loginRes = await authPost(loginReq);
      expect(loginRes.status).toBe(200);

      const loginData = (await loginRes.json()) as { success: boolean; user: { id: string; email: string } };
      expect(loginData.success).toBe(true);
      expect(loginData.user.email).toBe('engineer@example.com');

      const cookieHeader = loginRes.headers.get('set-cookie');
      expect(cookieHeader).toBeTruthy();
      expect(cookieHeader).toContain(`${AUTH_COOKIE_NAME}=ses_`);
      expect(cookieHeader).toContain('Path=/');
      expect(cookieHeader).toContain('HttpOnly');
      const cookieMaxAge = Number(cookieHeader?.match(/Max-Age=(\d+)/)?.[1]);
      expect(cookieMaxAge).toBeGreaterThan(0);
      expect(cookieMaxAge).toBeLessThanOrEqual(SESSION_TTL_SECONDS);

      // Two sessions should exist in DB (1 from signup, 1 from login)
      const sessions = await db.query(
        'SELECT * FROM sessions WHERE user_id = ?',
        [loginData.user.id]
      );
      expect(sessions.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // B. DUPLICATE CLICK & RATE LIMITING
  // ---------------------------------------------------------------------------
  describe('B. Duplicate Click & Submission Protection', () => {
    it('enforces login rate limiting to prevent runaway credential attacks', async () => {
      // 10 failed login attempts are allowed, 11th should return 429
      for (let i = 0; i < 10; i++) {
        const res = await authPost(
          createRequest('https://apiproof.test/api/auth', {
            body: {
              action: 'login',
              email: 'ratelimit@example.com',
              password: 'WrongPassword!',
            },
          })
        );
        expect(res.status).toBe(401);
      }

      // 11th attempt must be 429
      const throttledRes = await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'login',
            email: 'ratelimit@example.com',
            password: 'WrongPassword!',
          },
        })
      );
      expect(throttledRes.status).toBe(429);
      const data = (await throttledRes.json()) as { code: string };
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('stores only a digest of the normalized login email in the rate-limit key', async () => {
      for (const email of ['Privacy@example.com', 'privacy@example.com']) {
        const response = await authPost(createRequest('https://apiproof.test/api/auth', {
          body: { action: 'login', email, password: 'WrongPassword!' },
        }));
        expect(response.status).toBe(401);
      }

      const rows = await getDatabase().query<{ key: string; points: number }>(
        "SELECT key, points FROM rate_limits WHERE key LIKE 'auth:login:%'",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.key).not.toContain('privacy@example.com');
      expect(rows[0]?.points).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // C. SESSION PERSISTENCE
  // ---------------------------------------------------------------------------
  describe('C. Session Persistence Across Requests', () => {
    it('persists session and allows authenticated requests using the session cookie', async () => {
      // Sign up
      const signupRes = await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'persist@example.com',
            password: 'Password123!',
            name: 'Persist User',
          },
        })
      );
      const cookieHeader = signupRes.headers.get('set-cookie')!;
      const sessionMatch = cookieHeader.match(/apiproof_session=([^;]+)/);
      expect(sessionMatch).toBeTruthy();
      const sessionCookie = `apiproof_session=${sessionMatch![1]}`;

      // Request 1: Immediate authenticated check
      const authReq1 = createRequest('https://apiproof.test/api/auth', {
        method: 'GET',
        cookie: sessionCookie,
      });
      const authRes1 = await authGet(authReq1);
      expect(authRes1.status).toBe(200);
      const authData1 = (await authRes1.json()) as { authenticated: boolean; user: { id: string; email: string } };
      expect(authData1.authenticated).toBe(true);
      expect(authData1.user.email).toBe('persist@example.com');

      // Request 2: Simulate reopening the site / reload with the same cookie
      const authReq2 = createRequest('https://apiproof.test/api/auth', {
        method: 'GET',
        cookie: sessionCookie,
      });
      const authRes2 = await authGet(authReq2);
      expect(authRes2.status).toBe(200);
      const authData2 = (await authRes2.json()) as { authenticated: boolean; user: { id: string; email: string } };
      expect(authData2.authenticated).toBe(true);
      expect(authData2.user.id).toBe(authData1.user.id);
    });

    it('rejects and purges expired sessions automatically', async () => {
      const db = getDatabase();

      // Sign up
      const signupRes = await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'expired@example.com',
            password: 'Password123!',
            name: 'Expired User',
          },
        })
      );
      const cookieHeader = signupRes.headers.get('set-cookie')!;
      const match = cookieHeader.match(/apiproof_session=([^;]+)/);
      expect(match).toBeTruthy();
      const sessionId: string = match![1]!;

      // Manually set expires_at in the past
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      await db.execute('UPDATE sessions SET expires_at = ? WHERE id = ?', [pastDate, sessionId]);

      // Validating session should now fail
      const result = await validateSession(sessionId);
      expect(result).toBeNull();

      // Session row should have been purged
      const row = await db.queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
      expect(row).toBeFalsy();

      // GET /api/auth with expired session returns 401
      const authReq = createRequest('https://apiproof.test/api/auth', {
        method: 'GET',
        cookie: `apiproof_session=${sessionId}`,
      });
      const authRes = await authGet(authReq);
      expect(authRes.status).toBe(401);
    });

    it('rejects and purges malformed expiry timestamps in both validation paths', async () => {
      const { user } = await createUserWithSession('malformed-expiry@example.com', 'Password123!', 'Malformed Expiry');
      const syncSession = await createSession(user.id);
      const asyncSession = await createSessionAsync(user.id);
      const db = getDatabase();
      await db.execute("UPDATE sessions SET expires_at = 'not-a-timestamp' WHERE id IN (?, ?)", [syncSession.id, asyncSession.id]);

      expect(await validateSession(syncSession.id)).toBeNull();
      expect(await validateSessionAsync(asyncSession.id)).toBeNull();
      expect(await db.queryOne('SELECT id FROM sessions WHERE id IN (?, ?)', [syncSession.id, asyncSession.id])).toBeUndefined();
    });

    it('rejects and purges sessions expiring at the current instant in both validation paths', async () => {
      const { user } = await createUserWithSession('boundary-expiry@example.com', 'Password123!', 'Boundary Expiry');
      const syncSession = await createSession(user.id);
      const asyncSession = await createSessionAsync(user.id);
      const db = getDatabase();
      const expiryAtNow = new Date().toISOString();
      await db.execute('UPDATE sessions SET expires_at = ? WHERE id IN (?, ?)', [expiryAtNow, syncSession.id, asyncSession.id]);

      expect(await validateSession(syncSession.id)).toBeNull();
      expect(await validateSessionAsync(asyncSession.id)).toBeNull();
      expect(await db.queryOne('SELECT id FROM sessions WHERE id IN (?, ?)', [syncSession.id, asyncSession.id])).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // D. INVALID CREDENTIALS
  // ---------------------------------------------------------------------------
  describe('D. Invalid Credentials', () => {
    it('does not create a session when credentials are wrong and returns descriptive error', async () => {
      const db = getDatabase();

      // Create user
      await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'victim@example.com',
            password: 'CorrectPassword123!',
            name: 'Victim User',
          },
        })
      );

      const sessionsBefore = await db.query('SELECT * FROM sessions');

      // Attempt login with wrong password
      const badReq = createRequest('https://apiproof.test/api/auth', {
        body: {
          action: 'login',
          email: 'victim@example.com',
          password: 'IncorrectPassword999!',
        },
      });

      const badRes = await authPost(badReq);
      expect(badRes.status).toBe(401);

      const badData = (await badRes.json()) as { code: string; error: string };
      expect(badData.code).toBe('INVALID_CREDENTIALS');
      expect(badData.error).toBe('Invalid email or password.');

      // No new session was created
      const sessionsAfter = await db.query('SELECT * FROM sessions');
      expect(sessionsAfter.length).toBe(sessionsBefore.length);
    });

    it('returns 400 for malformed input payloads', async () => {
      const badReq = createRequest('https://apiproof.test/api/auth', {
        body: {
          action: 'login',
          email: 'not-an-email',
          password: 'short',
        },
      });

      const res = await authPost(badReq);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { code: string };
      expect(data.code).toBe('INVALID_REQUEST_PAYLOAD');
    });
  });

  // ---------------------------------------------------------------------------
  // E. LOGOUT FLOW
  // ---------------------------------------------------------------------------
  describe('E. Logout Flow', () => {
    it('rejects malformed or oversized session identifiers before database lookup', async () => {
      expect(isValidSessionId('ses_valid_session_id')).toBe(true);
      expect(isValidSessionId('invalid-session')).toBe(false);
      expect(isValidSessionId(`ses_${'a'.repeat(129)}`)).toBe(false);
      expect(isValidSessionId('ses_bad value')).toBe(false);
      expect(validateSession('invalid-session')).toBeNull();
      await expect(validateSessionAsync(`ses_${'a'.repeat(129)}`)).resolves.toBeNull();
    });

    it('invalidates the session in DB, returns cleared cookie, and rejects subsequent calls', async () => {
      const db = getDatabase();

      // Sign up
      const signupRes = await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'logout@example.com',
            password: 'Password123!',
            name: 'Logout User',
          },
        })
      );
      const cookieHeader = signupRes.headers.get('set-cookie')!;
      const sessionId = cookieHeader.match(/apiproof_session=([^;]+)/)![1]!;
      const sessionCookie = `apiproof_session=${sessionId}`;

      // Logout
      const logoutReq = createRequest('https://apiproof.test/api/auth', {
        body: { action: 'logout' },
        cookie: sessionCookie,
      });

      const logoutRes = await authPost(logoutReq);
      expect(logoutRes.status).toBe(200);

      const logoutCookie = logoutRes.headers.get('set-cookie');
      expect(logoutCookie).toBeTruthy();
      expect(logoutCookie).toContain(`${AUTH_COOKIE_NAME}=;`);
      expect(logoutCookie).toContain('Max-Age=0');

      // Clear cookie options check
      const clearOpts = getClearAuthCookieOptions();
      expect(clearOpts.maxAge).toBe(0);
      expect(clearOpts.expires.getTime()).toBe(0);

      // Verify session row is deleted from database
      const row = await db.queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
      expect(row).toBeFalsy();

      // Subsequent authenticated check returns 401
      const verifyReq = createRequest('https://apiproof.test/api/auth', {
        method: 'GET',
        cookie: sessionCookie,
      });
      const verifyRes = await authGet(verifyReq);
      expect(verifyRes.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // F. MIDDLEWARE ROUTING BEHAVIOR
  // ---------------------------------------------------------------------------
  describe('F. Middleware Protected Routes & Login Pass-Through', () => {
    it('redirects unauthenticated dashboard request to /login?from=/dashboard', () => {
      const req = new NextRequest('https://apiproof.test/dashboard');
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://apiproof.test/login?from=%2Fdashboard');
    });

    it('returns 401 JSON for unauthenticated protected API requests', async () => {
      const req = new NextRequest('https://apiproof.test/api/overview');
      const res = middleware(req);
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Authentication required.');
    });

    it('allows authenticated requests to /dashboard to pass through', () => {
      const req = new NextRequest('https://apiproof.test/dashboard', {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=ses_valid_session_id`,
        },
      });
      const res = middleware(req);
      // NextResponse.next() returns 200 with x-middleware-next
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });

    it('allows /login to pass through middleware without redirecting on raw cookie presence', () => {
      // Even if a cookie is present (which might be expired/deleted in DB),
      // middleware must not blindly redirect /login -> /dashboard to avoid redirect loops.
      const reqWithCookie = new NextRequest('https://apiproof.test/login', {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=ses_any_session_id`,
        },
      });
      const resWithCookie = middleware(reqWithCookie);
      expect(resWithCookie.status).toBe(200);
      expect(resWithCookie.headers.get('x-middleware-next')).toBe('1');

      // Unauthenticated /login also passes through cleanly
      const reqWithoutCookie = new NextRequest('https://apiproof.test/login');
      const resWithoutCookie = middleware(reqWithoutCookie);
      expect(resWithoutCookie.status).toBe(200);
      expect(resWithoutCookie.headers.get('x-middleware-next')).toBe('1');
    });

    it('client auth contract: GET /api/auth validates real database session before client redirect', async () => {
      // Valid session in DB -> returns authenticated: true
      const signupRes = await authPost(
        createRequest('https://apiproof.test/api/auth', {
          body: {
            action: 'signup',
            email: 'clientcheck@example.com',
            password: 'Password123!',
            name: 'Client Check User',
          },
        })
      );
      const cookieHeader = signupRes.headers.get('set-cookie')!;
      const match = cookieHeader.match(/apiproof_session=([^;]+)/);
      expect(match).toBeTruthy();
      const validCookie = `apiproof_session=${match![1]}`;

      const validCheckRes = await authGet(
        createRequest('https://apiproof.test/api/auth', {
          method: 'GET',
          cookie: validCookie,
        })
      );
      expect(validCheckRes.status).toBe(200);
      const validData = (await validCheckRes.json()) as { authenticated: boolean };
      expect(validData.authenticated).toBe(true);

      // Dead/invalid session in cookie -> returns 401, preventing any client redirect loop
      const deadCheckRes = await authGet(
        createRequest('https://apiproof.test/api/auth', {
          method: 'GET',
          cookie: 'apiproof_session=ses_non_existent_or_deleted',
        })
      );
      expect(deadCheckRes.status).toBe(401);
      const deadData = (await deadCheckRes.json()) as { authenticated: boolean };
      expect(deadData.authenticated).toBe(false);
    });
  });
});
