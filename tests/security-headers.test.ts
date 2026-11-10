import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../apps/web/src/middleware.js';
import { buildSecurityHeaders, readConfiguredCorsOrigins, resolveCorsOrigin } from '../apps/web/src/lib/server/security-headers.js';

const originalCorsOrigins = process.env.APIPROOF_CORS_ORIGINS;

afterEach(() => {
  if (originalCorsOrigins === undefined) delete process.env.APIPROOF_CORS_ORIGINS;
  else process.env.APIPROOF_CORS_ORIGINS = originalCorsOrigins;
});

describe('security headers and exact-origin CORS', () => {
  it('normalizes only explicit HTTP(S) origins', () => {
    expect(readConfiguredCorsOrigins('https://app.example, https://app.example/ , javascript:alert(1), *')).toEqual(['https://app.example', 'https://app.example']);
  });

  it('allows only an exact configured origin', () => {
    expect(resolveCorsOrigin('https://app.example', ['https://app.example'])).toBe('https://app.example');
    expect(resolveCorsOrigin('https://evil.example', ['https://app.example'])).toBeNull();
    expect(resolveCorsOrigin('https://app.example.evil', ['https://app.example'])).toBeNull();
  });

  it('emits hardened HTTPS headers and credentialed CORS for an approved API origin', () => {
    const headers = buildSecurityHeaders({
      isHttps: true,
      isApiRequest: true,
      origin: 'https://app.example',
      configuredCorsOrigins: ['https://app.example'],
    });

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('does not emit wildcard or credentialed CORS for an unapproved origin', () => {
    const headers = buildSecurityHeaders({
      isHttps: false,
      isApiRequest: true,
      origin: 'https://evil.example',
      configuredCorsOrigins: ['https://app.example'],
    });

    expect(headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(headers.get('Strict-Transport-Security')).toBeNull();
    expect(headers.get('Vary')).toBe('Origin');
  });

  it('protects an authenticated API route while retaining approved CORS headers', () => {
    process.env.APIPROOF_CORS_ORIGINS = 'https://app.example';
    const response = middleware(new NextRequest('https://myowl.dev/api/findings', {
      headers: { origin: 'https://app.example' },
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('rejects unapproved preflight origins and accepts approved preflight origins', () => {
    process.env.APIPROOF_CORS_ORIGINS = 'https://app.example';
    const denied = middleware(new NextRequest('https://myowl.dev/api/findings', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    }));
    const allowed = middleware(new NextRequest('https://myowl.dev/api/findings', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example' },
    }));

    expect(denied.status).toBe(403);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  });
});
