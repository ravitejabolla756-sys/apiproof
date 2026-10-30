import { describe, expect, it } from 'vitest';
import { runBetaLivePreflight } from '../apps/web/scripts/beta-live-preflight.js';

describe('beta live preflight', () => {
  it('checks the authenticated status contract without invoking mutating routes', async () => {
    let requestedUrl = '';
    const recentSuccessAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = await runBetaLivePreflight('https://owl.example.com/', 'secret', async (input, init) => {
      requestedUrl = String(input);
      if (!init?.headers) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({
        ok: true,
        configuration: { readyForLiveBeta: true },
        runtime: { productizationV1Enabled: true, workerCommitSha: 'a'.repeat(40), workerVersion: '0.7.0', providerRegistryDigest: 'b'.repeat(64) },
        sources: ['stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack', 'sendgrid', 'shopify', 'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree']
          .map((providerId) => ({ providerId, sourceUrl: `https://${providerId}.example.com/changelog`, enabled: true, status: 'healthy', lastSuccessAt: recentSuccessAt, parserStatus: 'review-only', failureCount: 0 })),
        queues: { approvedCandidates: 0, reviewCandidates: 2, pendingRescans: 0, pendingScanRequests: 0, worker: { pending: 0, processing: 0 } },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    }, 'b'.repeat(64));

    expect(result.status).toBe('pass');
    expect(requestedUrl).toBe('https://owl.example.com/api/internal/provider-intelligence/status');
  });

  it('fails closed when the deployed catalog is incomplete', async () => {
    const result = await runBetaLivePreflight('https://owl.example.com', 'secret', async (_input, init) => {
      if (!init?.headers) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({
      runtime: { productizationV1Enabled: true, workerCommitSha: 'a'.repeat(40), workerVersion: '0.7.0' },
      sources: [],
      queues: { pendingRescans: 0 },
      }), { status: 200 });
    }, 'b'.repeat(64));

    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'source-catalog')?.status).toBe('fail');
  });

  it('identifies a stale deployment that serves an HTML 404 instead of the status contract', async () => {
    const result = await runBetaLivePreflight('https://owl.example.com', 'secret', async (_input, init) => {
      if (!init?.headers) return new Response(null, { status: 401 });
      return new Response('<!doctype html><title>404</title>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      });
    }, 'b'.repeat(64));

    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'status-json')).toMatchObject({ status: 'fail' });
    expect(result.checks.find((check) => check.id === 'status-contract')).toMatchObject({ status: 'fail' });
    expect(result.checks.find((check) => check.id === 'authenticated-status-endpoint')?.detail).toBe('status=404');
  });

  it('fails closed when the deployed registry differs from the expected release digest', async () => {
    const result = await runBetaLivePreflight('https://owl.example.com', 'secret', async (_input, init) => {
      if (!init?.headers) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({
        runtime: { productizationV1Enabled: true, workerCommitSha: 'a'.repeat(40), workerVersion: '0.7.0', providerRegistryDigest: 'b'.repeat(64) },
        sources: [],
        queues: { pendingRescans: 0 },
      }), { status: 200 });
    }, 'c'.repeat(64));

    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'provider-registry-digest-match')).toMatchObject({ status: 'fail' });
  });

  it('fails closed when a provider source is older than the six-hour monitoring window', async () => {
    const stale = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const result = await runBetaLivePreflight('https://owl.example.com', 'secret', async (_input, init) => {
      if (!init?.headers) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({
        runtime: { productizationV1Enabled: true, workerCommitSha: 'a'.repeat(40), workerVersion: '0.7.0', providerRegistryDigest: 'b'.repeat(64) },
        sources: ['stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack', 'sendgrid', 'shopify', 'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree']
          .map((providerId) => ({ providerId, sourceUrl: `https://${providerId}.example.com/changelog`, enabled: true, status: 'healthy', lastSuccessAt: stale, parserStatus: 'review-only', failureCount: 0 })),
        queues: { pendingRescans: 0 },
      }), { status: 200 });
    }, 'b'.repeat(64));

    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'source-freshness')).toMatchObject({ status: 'fail' });
  });
});
