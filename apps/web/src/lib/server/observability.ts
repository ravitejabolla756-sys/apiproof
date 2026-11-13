export const OBSERVABILITY_METRICS = [
  'request_failures',
  'scan_queue_lag',
  'billing_errors',
  'worker_failures',
] as const;

export type ObservabilityMetric = (typeof OBSERVABILITY_METRICS)[number];
export type TelemetryAttributeValue = string | number | boolean | null;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>;

export interface TelemetrySink {
  increment(metric: ObservabilityMetric, value?: number, attributes?: TelemetryAttributes): void;
  observe(metric: ObservabilityMetric, value: number, attributes?: TelemetryAttributes): void;
}

const ALLOWED_ATTRIBUTE_KEYS = new Set([
  'code',
  'route',
  'method',
  'status',
  'provider',
  'job_type',
  'reason',
  'duration_ms',
  'lag_ms',
]);

const SECRET_OR_PII_KEY = /(?:authorization|cookie|email|ip|name|password|secret|token|user|workspace|tenant|url|credential|key)/i;
const MAX_ATTRIBUTE_LENGTH = 160;

function safeString(value: string): string {
  const redacted = value.replace(
    /((?:authorization|cookie|password|secret|token|api[_-]?key)\s*[=:]\s*)([^\s&#,;]+)/gi,
    '$1[REDACTED]',
  );
  return redacted.length > MAX_ATTRIBUTE_LENGTH ? `${redacted.slice(0, MAX_ATTRIBUTE_LENGTH)}…` : redacted;
}

/** Keep telemetry bounded and free of credentials, tenant identifiers, and PII. */
export function redactTelemetryAttributes(attributes: TelemetryAttributes = {}): TelemetryAttributes {
  const redacted: TelemetryAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!ALLOWED_ATTRIBUTE_KEYS.has(key) || SECRET_OR_PII_KEY.test(key)) continue;
    if (typeof value === 'string') redacted[key] = safeString(value);
    else if (typeof value === 'number' && Number.isFinite(value)) redacted[key] = value;
    else if (typeof value === 'boolean' || value === null) redacted[key] = value;
  }
  return redacted;
}

export function createNoopTelemetry(): TelemetrySink {
  return {
    increment: () => undefined,
    observe: () => undefined,
  };
}

export interface LocalTelemetrySnapshot {
  counters: Record<ObservabilityMetric, number>;
  observations: Array<{ metric: ObservabilityMetric; value: number; attributes: TelemetryAttributes }>;
}

/** Disposable in-memory sink for local tests and development diagnostics only. */
export class LocalTelemetry implements TelemetrySink {
  private readonly counters = new Map<ObservabilityMetric, number>();
  private readonly observations: LocalTelemetrySnapshot['observations'] = [];

  increment(metric: ObservabilityMetric, value = 1, attributes: TelemetryAttributes = {}): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
    void redactTelemetryAttributes(attributes);
  }

  observe(metric: ObservabilityMetric, value: number, attributes: TelemetryAttributes = {}): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.observations.push({ metric, value, attributes: redactTelemetryAttributes(attributes) });
  }

  snapshot(): LocalTelemetrySnapshot {
    const counters = Object.fromEntries(
      OBSERVABILITY_METRICS.map((metric) => [metric, this.counters.get(metric) ?? 0]),
    ) as Record<ObservabilityMetric, number>;
    return { counters, observations: this.observations.map((entry) => ({ ...entry, attributes: { ...entry.attributes } })) };
  }
}

export function getTelemetrySink(sink?: TelemetrySink): TelemetrySink {
  return sink ?? createNoopTelemetry();
}
