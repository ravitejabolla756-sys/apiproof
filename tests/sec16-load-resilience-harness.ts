import { performance } from 'node:perf_hooks';

export const SEC16_MAX_ITERATIONS = 200;
export const SEC16_MAX_CONCURRENCY = 16;
export const SEC16_DEFAULT_TIMEOUT_MS = 2_000;

export interface LocalLoadScenario {
  name: string;
  iterations: number;
  concurrency: number;
  timeoutMs?: number;
  operation: (iteration: number, signal: AbortSignal) => Promise<void> | void;
}

export interface LoadReport {
  name: string;
  iterations: number;
  started: number;
  notStarted: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  throughputPerSecond: number;
  maxInFlight: number;
  latencyMs: {
    min: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  errors: Readonly<Record<string, number>>;
}

export interface RetryReport {
  status: 'recovered' | 'exhausted';
  attempts: number;
  errors: ReadonlyArray<string>;
}

function assertLocalHarnessEnvironment(): void {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL || process.env.APIPROOF_DATABASE_URL) {
    throw new Error('SEC16_LOCAL_ONLY: load and resilience harness cannot run in production');
  }
}

function assertBoundedInteger(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`SEC16_INVALID_${name.toUpperCase()}`);
  }
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z0-9_:-]{1,80}$/.test(error.message)) return error.message;
  return 'OPERATION_FAILED';
}

function percentile(sortedValues: ReadonlyArray<number>, percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower]!;
  const weight = index - lower;
  return sortedValues[lower]! + (sortedValues[upper]! - sortedValues[lower]!) * weight;
}

function withTimeout(operation: Promise<void>, timeoutMs: number, onTimeout: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error('OPERATION_TIMEOUT'));
    }, timeoutMs);
    operation.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Runs only caller-supplied in-process operations. It never creates HTTP
 * clients, opens sockets, or selects a configured production database.
 */
export async function runLocalLoadScenario(options: LocalLoadScenario): Promise<LoadReport> {
  assertLocalHarnessEnvironment();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.name)) {
    throw new Error('SEC16_INVALID_SCENARIO_NAME');
  }
  assertBoundedInteger('iterations', options.iterations, 1, SEC16_MAX_ITERATIONS);
  assertBoundedInteger('concurrency', options.concurrency, 1, SEC16_MAX_CONCURRENCY);
  const timeoutMs = options.timeoutMs ?? SEC16_DEFAULT_TIMEOUT_MS;
  assertBoundedInteger('timeout_ms', timeoutMs, 1, 60_000);

  const latencies: number[] = [];
  const errors = new Map<string, number>();
  let nextIteration = 0;
  let started = 0;
  let stopScheduling = false;
  let succeeded = 0;
  let failed = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const startedAt = performance.now();

  async function runOne(iteration: number): Promise<void> {
    const operationStartedAt = performance.now();
    const controller = new AbortController();
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await withTimeout(Promise.resolve(options.operation(iteration, controller.signal)), timeoutMs, () => {
        stopScheduling = true;
        controller.abort();
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const code = safeErrorCode(error);
      errors.set(code, (errors.get(code) ?? 0) + 1);
    } finally {
      latencies.push(performance.now() - operationStartedAt);
      inFlight -= 1;
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      if (stopScheduling) return;
      const iteration = nextIteration;
      nextIteration += 1;
      if (iteration >= options.iterations) return;
      started += 1;
      await runOne(iteration);
    }
  }

  const workers = Array.from(
    { length: Math.min(options.concurrency, options.iterations) },
    () => worker(),
  );
  await Promise.all(workers);

  const durationMs = performance.now() - startedAt;
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  return {
    name: options.name,
    iterations: options.iterations,
    started,
    notStarted: options.iterations - started,
    succeeded,
    failed,
    durationMs,
    throughputPerSecond: durationMs === 0 ? 0 : (started / durationMs) * 1_000,
    maxInFlight,
    latencyMs: {
      min: sortedLatencies[0] ?? 0,
      p50: percentile(sortedLatencies, 0.50),
      p95: percentile(sortedLatencies, 0.95),
      p99: percentile(sortedLatencies, 0.99),
      max: sortedLatencies.at(-1) ?? 0,
    },
    errors: Object.fromEntries(errors),
  };
}

/**
 * Executes bounded retry behavior against a deterministic injected operation.
 * The operation receives a one-based attempt number and cannot exceed the
 * caller's retry budget.
 */
export async function runBoundedRetryScenario(options: {
  maxAttempts: number;
  operation: (attempt: number) => Promise<void> | void;
}): Promise<RetryReport> {
  assertLocalHarnessEnvironment();
  assertBoundedInteger('max_attempts', options.maxAttempts, 1, 10);
  const errors: string[] = [];

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      await options.operation(attempt);
      return { status: 'recovered', attempts: attempt, errors };
    } catch (error) {
      errors.push(safeErrorCode(error));
    }
  }

  return { status: 'exhausted', attempts: options.maxAttempts, errors };
}
