import { describe, expect, it } from 'vitest';
import {
  LocalTelemetry,
  createNoopTelemetry,
  getTelemetrySink,
  redactTelemetryAttributes,
} from '../apps/web/src/lib/server/observability.js';

describe('SEC-11 local observability contract', () => {
  it('redacts PII, credentials, unknown fields, and bounds strings', () => {
    const attributes = redactTelemetryAttributes({
      code: 'WORKER_FAILED',
      route: '/api/internal/scan-worker',
      status: 500,
      workspace_id: 'workspace-secret',
      email: 'person@example.test',
      authorization: 'Bearer secret',
      reason: 'x'.repeat(300),
    });

    expect(attributes).toMatchObject({ code: 'WORKER_FAILED', route: '/api/internal/scan-worker', status: 500 });
    expect(attributes).not.toHaveProperty('workspace_id');
    expect(attributes).not.toHaveProperty('email');
    expect(attributes).not.toHaveProperty('authorization');
    expect(String(attributes.reason).length).toBeLessThanOrEqual(161);
  });

  it('records only bounded local counters and sanitized observations', () => {
    const telemetry = new LocalTelemetry();
    telemetry.increment('request_failures', 2, { code: 'AUTH_FAILED', user_id: 'user-secret' });
    telemetry.increment('worker_failures', -1);
    telemetry.observe('scan_queue_lag', 12, { lag_ms: 12, workspace_id: 'workspace-secret' });

    expect(telemetry.snapshot()).toEqual({
      counters: { request_failures: 2, scan_queue_lag: 0, billing_errors: 0, worker_failures: 0 },
      observations: [{ metric: 'scan_queue_lag', value: 12, attributes: { lag_ms: 12 } }],
    });
  });

  it('provides a safe no-op fallback when no provider is configured', () => {
    const sink = getTelemetrySink();
    expect(sink).toBeDefined();
    expect(() => sink.increment('billing_errors')).not.toThrow();
    expect(() => createNoopTelemetry().observe('worker_failures', 1)).not.toThrow();
  });
});
