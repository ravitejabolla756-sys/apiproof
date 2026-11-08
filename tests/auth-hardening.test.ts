import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertCsrfProtection } from '../apps/web/src/lib/server/validation.js';
import { getAuthCookieOptions, SESSION_TTL_SECONDS } from '../apps/web/src/lib/server/auth.js';

afterEach(() => vi.unstubAllEnvs());

describe('authentication hardening', () => {
  it('fails closed when a production browser mutation has no origin or referer', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev' },
    }));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Origin or Referer');
  });

  it('accepts a matching production referer when origin is unavailable', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: {
        host: 'myowl.dev',
        referer: 'https://myowl.dev/dashboard/repositories',
      },
    }));

    expect(result.valid).toBe(true);
  });

  it('fails closed when Origin is present but the request host is unavailable', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    }));

    expect(result).toEqual({ valid: false, error: 'Forbidden: Request host is unavailable.' });
  });

  it('rejects a mismatched Origin even when the request host is present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev', origin: 'https://evil.example' },
    }));

    expect(result).toEqual({ valid: false, error: 'Forbidden: Origin header does not match request origin.' });
  });

  it('rejects malformed Origin values and explicit cross-site fetch metadata', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const malformed = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev', origin: 'not-an-origin' },
    }));
    const crossSite = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev', origin: 'https://myowl.dev', 'sec-fetch-site': 'cross-site' },
    }));

    expect(malformed).toEqual({ valid: false, error: 'Forbidden: Invalid Origin header.' });
    expect(crossSite).toEqual({ valid: false, error: 'Forbidden: Cross-site request rejected.' });
  });

  it('rejects Origin values containing URL components that are not part of an origin', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const malformedOrigins = [
      'https://myowl.dev/dashboard',
      'https://user@myowl.dev',
      'https://myowl.dev?next=/dashboard',
      'https://myowl.dev#fragment',
      'https://myowl.dev/',
    ];

    for (const origin of malformedOrigins) {
      expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
        method: 'POST',
        headers: { host: 'myowl.dev', origin },
      }))).toEqual({ valid: false, error: 'Forbidden: Invalid Origin header.' });
    }
  });

  it('compares the complete Origin tuple and honors trusted forwarded proxy origin headers', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const wrongScheme = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev', origin: 'http://myowl.dev' },
    }));
    const forwardedOrigin = assertCsrfProtection(new Request('http://internal.local/api/repositories', {
      method: 'POST',
      headers: {
        host: 'internal.local',
        'x-forwarded-host': 'myowl.dev',
        'x-forwarded-proto': 'https',
        origin: 'https://myowl.dev',
      },
    }));
    const wrongRefererScheme = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', {
      method: 'POST',
      headers: { host: 'myowl.dev', referer: 'http://myowl.dev/dashboard' },
    }));

    expect(wrongScheme).toEqual({ valid: false, error: 'Forbidden: Origin header does not match request origin.' });
    expect(forwardedOrigin).toEqual({ valid: true });
    expect(wrongRefererScheme).toEqual({ valid: false, error: 'Forbidden: Referer header does not match request origin.' });
  });

  it('rejects ambiguous comma-separated forwarded protocol values', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('http://internal.local/api/repositories', {
      method: 'POST',
      headers: {
        host: 'internal.local',
        'x-forwarded-host': 'myowl.dev',
        'x-forwarded-proto': 'https, http',
        origin: 'https://myowl.dev',
      },
    }));

    expect(result).toEqual({ valid: false, error: 'Forbidden: Request origin is unavailable.' });
  });

  it('marks the session cookie secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthCookieOptions().secure).toBe(true);
    expect(getAuthCookieOptions().httpOnly).toBe(true);
    expect(getAuthCookieOptions().sameSite).toBe('lax');
  });

  it('bounds cookie Max-Age to the remaining session lifetime and expires invalid timestamps immediately', () => {
    const soon = new Date(Date.now() + 5_000);
    const nearExpiry = getAuthCookieOptions(soon);
    expect(nearExpiry.expires.getTime()).toBe(soon.getTime());
    expect(nearExpiry.maxAge).toBeGreaterThan(0);
    expect(nearExpiry.maxAge).toBeLessThanOrEqual(5);
    expect(nearExpiry.maxAge).toBeLessThan(SESSION_TTL_SECONDS);

    const expired = getAuthCookieOptions(new Date(Date.now() - 1_000));
    const malformed = getAuthCookieOptions('not-a-timestamp');
    expect(expired.maxAge).toBe(0);
    expect(malformed.maxAge).toBe(0);
    expect(Number.isFinite(malformed.expires.getTime())).toBe(true);
  });
});
