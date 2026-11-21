export interface ScanWorkerRequestOptions {
  batchSize?: number;
  timeoutMs?: number;
  metricsOnly?: boolean;
  repositoryId?: string;
}

export type ScanWorkerRequestParseResult =
  | { ok: true; value: ScanWorkerRequestOptions }
  | { ok: false; code: 'INVALID_SCAN_WORKER_REQUEST' };

const MAX_BATCH_SIZE = 20;
const MAX_TIMEOUT_MS = 270_000;
const REPOSITORY_ID_PATTERN = /^[A-Za-z0-9_.-]{1,150}$/;

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

/**
 * Validates the internal worker request before it reaches queue SQL or the
 * scan executor. Missing fields retain the worker defaults; supplied fields
 * must be finite, bounded values so malformed cron/manual requests fail
 * closed instead of producing invalid LIMIT or deadline calculations.
 */
export function parseScanWorkerRequest(input: unknown): ScanWorkerRequestParseResult {
  if (input === undefined || input === null) return { ok: true, value: {} };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'INVALID_SCAN_WORKER_REQUEST' };
  }

  const candidate = input as Record<string, unknown>;
  const value: ScanWorkerRequestOptions = {};

  if (candidate.batchSize !== undefined) {
    if (!isBoundedInteger(candidate.batchSize, 1, MAX_BATCH_SIZE)) {
      return { ok: false, code: 'INVALID_SCAN_WORKER_REQUEST' };
    }
    value.batchSize = candidate.batchSize;
  }

  if (candidate.timeoutMs !== undefined) {
    if (!isBoundedInteger(candidate.timeoutMs, 1_000, MAX_TIMEOUT_MS)) {
      return { ok: false, code: 'INVALID_SCAN_WORKER_REQUEST' };
    }
    value.timeoutMs = candidate.timeoutMs;
  }

  if (candidate.metricsOnly !== undefined) {
    if (typeof candidate.metricsOnly !== 'boolean') {
      return { ok: false, code: 'INVALID_SCAN_WORKER_REQUEST' };
    }
    value.metricsOnly = candidate.metricsOnly;
  }

  if (candidate.repositoryId !== undefined) {
    if (typeof candidate.repositoryId !== 'string' || !REPOSITORY_ID_PATTERN.test(candidate.repositoryId)) {
      return { ok: false, code: 'INVALID_SCAN_WORKER_REQUEST' };
    }
    value.repositoryId = candidate.repositoryId;
  }

  return { ok: true, value };
}
