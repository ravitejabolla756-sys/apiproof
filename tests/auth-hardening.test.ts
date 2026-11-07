import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertCsrfProtection } from '../apps/web/src/lib/server/validation.js';
import { getAuthCookieOptions } from '../apps/web/src/lib/server/auth.js';

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

    expect(result).toEqual({ valid: false, error: 'Forbidden: Origin header does not match host.' });
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

  it('marks the session cookie secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthCookieOptions().secure).toBe(true);
    expect(getAuthCookieOptions().httpOnly).toBe(true);
    expect(getAuthCookieOptions().sameSite).toBe('lax');
  });
});
