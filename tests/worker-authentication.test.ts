import { describe, expect, it, afterEach } from 'vitest';
import { assertTrustedWorkerIdentity, createWorkerAuthHeaders, verifyInternalWorkerRequest, verifyWorkerRequest, workerIdentityToken } from '../apps/web/src/lib/server/worker-auth.js';

const SECRET = 'worker-auth-test-secret-32-chars-long!';
const original = { nodeEnv: process.env.NODE_ENV, cron: process.env.CRON_SECRET, workerSecret: process.env.WORKER_AUTH_SECRET, token: process.env.WORKER_AUTH_TOKEN };

afterEach(() => {
  if (original.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.nodeEnv;
  if (original.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original.cron;
  if (original.workerSecret === undefined) delete process.env.WORKER_AUTH_SECRET; else process.env.WORKER_AUTH_SECRET = original.workerSecret;
  if (original.token === undefined) delete process.env.WORKER_AUTH_TOKEN; else process.env.WORKER_AUTH_TOKEN = original.token;
});

describe('trusted worker authentication', () => {
  it('accepts a current request signed for its exact method and path', () => {
    process.env.NODE_ENV = 'production';
    process.env.WORKER_AUTH_SECRET = SECRET;
    const timestamp = Date.now();
    const request = new Request('https://owl.test/api/internal/scan-worker', { method: 'POST', headers: createWorkerAuthHeaders({ secret: SECRET, workerId: 'scheduler-1', timestamp, method: 'POST', pathname: '/api/internal/scan-worker' }) });
    expect(verifyWorkerRequest(request, timestamp)).toBe(true);
    expect(verifyInternalWorkerRequest(request)).toBe(true);
  });

  it('rejects path, timestamp, missing-secret and malformed-signature changes', () => {
    process.env.NODE_ENV = 'production';
    process.env.WORKER_AUTH_SECRET = SECRET;
    const timestamp = Date.now();
    const headers = createWorkerAuthHeaders({ secret: SECRET, workerId: 'scheduler-1', timestamp, method: 'GET', pathname: '/api/internal/provider-changelog' });
    expect(verifyWorkerRequest(new Request('https://owl.test/api/internal/scheduled-rescan', { headers }), timestamp)).toBe(false);
    expect(verifyWorkerRequest(new Request('https://owl.test/api/internal/provider-changelog', { headers }), timestamp - 6 * 60 * 1000)).toBe(false);
    headers['x-apiproof-worker-signature'] = '0'.repeat(64);
    expect(verifyWorkerRequest(new Request('https://owl.test/api/internal/provider-changelog', { headers }), timestamp)).toBe(false);
    delete process.env.WORKER_AUTH_SECRET;
    expect(verifyWorkerRequest(new Request('https://owl.test/api/internal/provider-changelog', { headers }), timestamp)).toBe(false);
  });

  it('rejects legacy bearer authentication in production but preserves local fixtures', () => {
    process.env.CRON_SECRET = 'legacy-cron-secret';
    process.env.NODE_ENV = 'production';
    const request = new Request('https://owl.test/api/internal/scan-worker', { headers: { authorization: 'Bearer legacy-cron-secret' } });
    expect(verifyInternalWorkerRequest(request)).toBe(false);
    process.env.NODE_ENV = 'test';
    expect(verifyInternalWorkerRequest(request)).toBe(true);
  });

  it('requires a derived token for production worker processes', () => {
    process.env.WORKER_AUTH_SECRET = SECRET;
    const token = workerIdentityToken(SECRET, 'verification-1');
    expect(() => assertTrustedWorkerIdentity('verification-1', token)).not.toThrow();
    expect(() => assertTrustedWorkerIdentity('verification-1', workerIdentityToken(SECRET, 'other-worker'))).toThrow('TRUSTED_WORKER_IDENTITY_REQUIRED');
    expect(() => assertTrustedWorkerIdentity('verification-1')).toThrow('TRUSTED_WORKER_IDENTITY_REQUIRED');
  });
});
