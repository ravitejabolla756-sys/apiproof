import { randomUUID } from 'node:crypto';
import { getDatabase } from './db/index.js';

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

const FRESHNESS_WINDOWS_MS: Partial<Record<WorkerComponent, number>> = {
  // Twice the declared schedule interval plus a bounded delivery allowance.
  'provider-changelog-scheduler': 12 * 60 * 60 * 1_000,
  'nightly-rescan-scheduler': 30 * 60 * 60 * 1_000,
};

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
    [now.toISOString(), status, errorCode === null ? null : /^[A-Z0-9_:-]{1,80}$/.test(errorCode) ? errorCode : 'WORKER_FAILED', component, runId],
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
    const ageMs = Number.isFinite(started) ? Math.max(0, now.getTime() - started) : 0;
    const window = FRESHNESS_WINDOWS_MS[row.component];
    byComponent.set(row.component, {
      component: row.component,
      runId: row.run_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      errorCode: row.error_code,
      ageMs,
      freshness: window === undefined ? 'unknown' : ageMs <= window ? 'current' : 'stale',
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
