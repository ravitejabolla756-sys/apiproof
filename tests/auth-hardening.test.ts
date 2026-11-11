import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertCsrfProtection } from '../apps/web/src/lib/server/validation.js';

afterEach(() => vi.unstubAllEnvs());

describe('authentication hardening', () => {
  it('fails closed when a production mutation has no origin or referer', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev' } }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Origin or Referer');
  });

  it('accepts a matching production referer and rejects missing request host', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', referer: 'https://myowl.dev/dashboard/repositories' } })).valid).toBe(true);
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { origin: 'https://evil.example' } }))).toEqual({ valid: false, error: 'Forbidden: Request host is unavailable.' });
  });

  it('rejects mismatched and malformed origins, including cross-site fetch metadata', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', origin: 'https://evil.example' } }))).toEqual({ valid: false, error: 'Forbidden: Origin header does not match request origin.' });
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', origin: 'not-an-origin' } }))).toEqual({ valid: false, error: 'Forbidden: Invalid Origin header.' });
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', origin: 'https://myowl.dev', 'sec-fetch-site': 'cross-site' } }))).toEqual({ valid: false, error: 'Forbidden: Cross-site request rejected.' });
  });

  it('rejects origin components and ambiguous forwarded protocols', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const origin of ['https://myowl.dev/dashboard', 'https://user@myowl.dev', 'https://myowl.dev?next=/dashboard', 'https://myowl.dev#fragment', 'https://myowl.dev/']) {
      expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', origin } })).valid).toBe(false);
    }
    expect(assertCsrfProtection(new Request('http://internal.local/api/repositories', { method: 'POST', headers: { host: 'internal.local', 'x-forwarded-host': 'myowl.dev', 'x-forwarded-proto': 'https, http', origin: 'https://myowl.dev' } }))).toEqual({ valid: false, error: 'Forbidden: Request origin is unavailable.' });
  });

  it('accepts trusted forwarded origin tuples and rejects wrong schemes', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(assertCsrfProtection(new Request('http://internal.local/api/repositories', { method: 'POST', headers: { host: 'internal.local', 'x-forwarded-host': 'myowl.dev', 'x-forwarded-proto': 'https', origin: 'https://myowl.dev' } })).valid).toBe(true);
    expect(assertCsrfProtection(new Request('https://myowl.dev/api/repositories', { method: 'POST', headers: { host: 'myowl.dev', origin: 'http://myowl.dev' } })).valid).toBe(false);
  });

});
