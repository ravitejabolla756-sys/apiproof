import { randomUUID } from 'node:crypto';
import { getDatabase } from './db/index.js';
import type { ScanWorkerMetrics } from './scan-worker-metrics.js';

export const WORKER_COMPONENTS = ['scan-worker', 'provider-changelog-scheduler', 'nightly-rescan-scheduler'] as const;
export type WorkerComponent = typeof WORKER_COMPONENTS[number];
export type WorkerRunStatus = 'succeeded' | 'degraded' | 'failed';

export interface WorkerHeartbeat {
  component: WorkerComponent;
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | WorkerRunStatus | 'unknown';
  errorCode: string | null;
  ageMs: number;
  freshness: 'current' | 'stale' | 'unknown';
}

export type WorkerHealthLevel = 'healthy' | 'degraded' | 'failed' | 'unknown';

export interface WorkerHealthAssessment {
  component: WorkerComponent;
  level: WorkerHealthLevel;
  reasons: string[];
}

export interface WorkerHealthAlertThresholds {
  maxStalledProcessingJobs: number;
  maxRetryExhaustedJobs: number;
}

export interface WorkerHealthAlert {
  component: WorkerComponent;
  shouldAlert: boolean;
  severity: 'warning' | 'critical' | null;
  reasonCodes: string[];
}

export interface WorkerHealthAlertSink {
  send(alert: WorkerHealthAlert): Promise<void>;
}

export type WorkerHealthAlertDelivery = 'not_needed' | 'sent' | 'failed';

const FRESHNESS_WINDOWS_MS: Partial<Record<WorkerComponent, number>> = {
  // Twice the declared schedule interval plus a bounded delivery allowance.
  'provider-changelog-scheduler': 12 * 60 * 60 * 1_000,
  'nightly-rescan-scheduler': 30 * 60 * 60 * 1_000,
};

const SAFE_WORKER_ERROR_CODES = new Set([
  'PROVIDER_CHANGE_REFRESH_FAILED',
  'SCAN_WORKER_DEGRADED',
  'SCAN_WORKER_FAILED',
  'SCHEDULED_RESCAN_FAILED',
  'SCHEDULED_WORK_DEGRADED',
]);

function sanitizeWorkerErrorCode(errorCode: string | null): string | null {
  return errorCode === null ? null : SAFE_WORKER_ERROR_CODES.has(errorCode) ? errorCode : 'WORKER_FAILED';
}

/**
 * Converts persisted worker evidence into a stable, non-secret health contract.
 * This is intentionally a pure classifier: alert routing and escalation remain
 * deployment policy, while callers receive deterministic reasons they can test.
 */
export function assessWorkerHealth(
  heartbeat: WorkerHeartbeat,
  metrics: Pick<ScanWorkerMetrics, 'stalledProcessingJobs' | 'retryExhaustedJobs'>,
): WorkerHealthAssessment {
  const reasons: string[] = [];
  if (heartbeat.status === 'failed') reasons.push('HEARTBEAT_FAILED');
  if (heartbeat.status === 'degraded') reasons.push('HEARTBEAT_DEGRADED');
  if (heartbeat.freshness === 'stale') reasons.push('HEARTBEAT_STALE');
  if (heartbeat.status === 'unknown') reasons.push('HEARTBEAT_UNKNOWN');
  if (heartbeat.component === 'scan-worker' && metrics.stalledProcessingJobs > 0) {
    reasons.push('STALLED_JOBS_PRESENT');
  }
  if (heartbeat.component === 'scan-worker' && metrics.retryExhaustedJobs > 0) {
    reasons.push('RETRY_EXHAUSTED_JOBS_PRESENT');
  }

  const level: WorkerHealthLevel = reasons.includes('HEARTBEAT_FAILED') || reasons.includes('RETRY_EXHAUSTED_JOBS_PRESENT')
    ? 'failed'
    : reasons.length > 0 && !reasons.every((reason) => reason === 'HEARTBEAT_UNKNOWN')
      ? 'degraded'
      : heartbeat.status === 'unknown'
        ? 'unknown'
        : 'healthy';
  return { component: heartbeat.component, level, reasons };
}

/**
 * Produces a destination-neutral alert decision from already-scrubbed health
 * evidence. Thresholds are injected so owners can approve them per environment
 * without coupling the backend to a monitoring vendor or inventing policy.
 */
export function evaluateWorkerHealthAlert(
  heartbeat: WorkerHeartbeat,
  metrics: Pick<ScanWorkerMetrics, 'stalledProcessingJobs' | 'retryExhaustedJobs'>,
  thresholds: WorkerHealthAlertThresholds,
): WorkerHealthAlert {
  if (!Number.isInteger(thresholds.maxStalledProcessingJobs) || thresholds.maxStalledProcessingJobs < 0
    || !Number.isInteger(thresholds.maxRetryExhaustedJobs) || thresholds.maxRetryExhaustedJobs < 0) {
    throw new Error('WORKER_HEALTH_INVALID_ALERT_THRESHOLDS');
  }
  const assessment = assessWorkerHealth(heartbeat, metrics);
  const reasonCodes = assessment.reasons.filter((reason) => reason !== 'STALLED_JOBS_PRESENT' && reason !== 'RETRY_EXHAUSTED_JOBS_PRESENT');
  if (heartbeat.component === 'scan-worker' && metrics.stalledProcessingJobs > thresholds.maxStalledProcessingJobs) {
    reasonCodes.push('STALLED_JOBS_THRESHOLD_EXCEEDED');
  }
  if (heartbeat.component === 'scan-worker' && metrics.retryExhaustedJobs > thresholds.maxRetryExhaustedJobs) {
    reasonCodes.push('RETRY_EXHAUSTED_JOBS_THRESHOLD_EXCEEDED');
  }

  const heartbeatAlert = heartbeat.status === 'failed' || heartbeat.status === 'degraded' || heartbeat.freshness === 'stale';
  const stalledThresholdExceeded = reasonCodes.includes('STALLED_JOBS_THRESHOLD_EXCEEDED');
  const retryThresholdExceeded = reasonCodes.includes('RETRY_EXHAUSTED_JOBS_THRESHOLD_EXCEEDED');
  const critical = heartbeat.status === 'failed' || retryThresholdExceeded;
  const shouldAlert = heartbeatAlert || stalledThresholdExceeded || retryThresholdExceeded;
  return {
    component: heartbeat.component,
    shouldAlert,
    severity: shouldAlert ? critical ? 'critical' : 'warning' : null,
    reasonCodes,
  };
}

/**
 * Delivers an already-evaluated alert through an injected sink. The sink is
 * intentionally destination-neutral: provider selection, credentials and
 * escalation policy stay outside the worker path. Delivery failure is
 * observable to the caller but cannot turn telemetry into job failure.
 */
export async function deliverWorkerHealthAlert(
  alert: WorkerHealthAlert,
  sink: WorkerHealthAlertSink,
): Promise<WorkerHealthAlertDelivery> {
  if (!alert.shouldAlert) return 'not_needed';
  try {
    await sink.send(alert);
    return 'sent';
  } catch {
    return 'failed';
  }
}

export async function startWorkerRun(component: WorkerComponent, now = new Date()): Promise<string> {
  const runId = randomUUID();
  await getDatabase().execute(
    `INSERT INTO worker_run_heartbeats (component, run_id, started_at, finished_at, status, error_code)
     VALUES (?, ?, ?, NULL, 'running', NULL)`,
    [component, runId, now.toISOString()],
  );
  await getDatabase().execute(
    `DELETE FROM worker_run_heartbeats WHERE component = ? AND status <> 'running' AND run_id NOT IN (
       SELECT run_id FROM worker_run_heartbeats WHERE component = ? ORDER BY started_at DESC LIMIT 100
     )`,
    [component, component],
  );
  return runId;
}

export async function tryStartWorkerRun(component: WorkerComponent): Promise<string | undefined> {
  try { return await startWorkerRun(component); } catch { return undefined; }
}

export async function finishWorkerRun(
  component: WorkerComponent,
  runId: string,
  status: WorkerRunStatus,
  errorCode: string | null = null,
  now = new Date(),
): Promise<void> {
  const result = await getDatabase().execute(
    `UPDATE worker_run_heartbeats SET finished_at = ?, status = ?, error_code = ?
     WHERE component = ? AND run_id = ? AND status = 'running'`,
    [now.toISOString(), status, sanitizeWorkerErrorCode(errorCode), component, runId],
  );
  if (result.changes !== 1) throw new Error('WORKER_HEARTBEAT_RUN_NOT_ACTIVE');
}

export async function tryFinishWorkerRun(
  component: WorkerComponent,
  runId: string | undefined,
  status: WorkerRunStatus,
  errorCode: string | null = null,
): Promise<void> {
  if (!runId) return;
  try { await finishWorkerRun(component, runId, status, errorCode); } catch { /* operational telemetry must not change job outcome */ }
}

export async function getWorkerHeartbeats(now = new Date()): Promise<WorkerHeartbeat[]> {
  let rows: Array<{
    component: WorkerComponent;
    run_id: string;
    started_at: string;
    finished_at: string | null;
    status: WorkerHeartbeat['status'];
    error_code: string | null;
  }>;
  try {
    rows = await getDatabase().query<{
      component: WorkerComponent;
      run_id: string;
      started_at: string;
      finished_at: string | null;
      status: WorkerHeartbeat['status'];
      error_code: string | null;
    }>(`SELECT h.component, h.run_id, h.started_at, h.finished_at, h.status, h.error_code
      FROM worker_run_heartbeats h
      WHERE NOT EXISTS (
        SELECT 1 FROM worker_run_heartbeats newer
        WHERE newer.component = h.component
          AND (newer.started_at > h.started_at OR (newer.started_at = h.started_at AND newer.run_id > h.run_id))
      )`);
  } catch {
    return WORKER_COMPONENTS.map((component) => ({
      component,
      runId: '',
      startedAt: '',
      finishedAt: null,
      status: 'unknown',
      errorCode: 'HEARTBEAT_STORE_UNAVAILABLE',
      ageMs: 0,
      freshness: 'unknown',
    }));
  }
  const byComponent = new Map<WorkerComponent, WorkerHeartbeat>();
  for (const row of rows) {
    const started = Date.parse(row.started_at);
    const timestampValid = Number.isFinite(started) && started <= now.getTime();
    const ageMs = timestampValid ? now.getTime() - started : 0;
    const window = FRESHNESS_WINDOWS_MS[row.component];
    byComponent.set(row.component, {
      component: row.component,
      runId: row.run_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      errorCode: sanitizeWorkerErrorCode(row.error_code),
      ageMs,
      freshness: window === undefined || !timestampValid
        ? 'unknown'
        : ageMs <= window ? 'current' : 'stale',
    });
  }
  return WORKER_COMPONENTS.map((component) => byComponent.get(component) ?? {
    component,
    runId: '',
    startedAt: '',
    finishedAt: null,
    status: 'unknown',
    errorCode: 'NO_HEARTBEAT_RECORDED',
    ageMs: 0,
    freshness: 'unknown',
  });
}

/** Keep operational history bounded while retaining recent incident evidence. */
export async function pruneWorkerHeartbeatHistory(component: WorkerComponent, retain = 100): Promise<void> {
  if (!Number.isInteger(retain) || retain < 10 || retain > 1_000) throw new Error('WORKER_HEARTBEAT_INVALID_RETENTION');
  await getDatabase().execute(
    `DELETE FROM worker_run_heartbeats WHERE component = ? AND run_id NOT IN (
       SELECT run_id FROM worker_run_heartbeats WHERE component = ? ORDER BY started_at DESC LIMIT ?
     )`,
    [component, component, retain],
  );
}
