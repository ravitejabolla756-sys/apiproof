export interface BillingSummary {
  subscription: {
    planId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    priceMonthly: number | null;
    limits: {
      maxRepositories: number | null;
      maxScansPerMonth: number | null;
      maxDraftPrsPerMonth: number | null;
    };
  };
  metrics: {
    repositories: BillingMetric;
    scans: BillingMetric;
    draftPrs: BillingMetric;
  };
}

export interface BillingMetric {
  current: number;
  limit: number | null;
  allowed: boolean;
}

/** Return a finite, clamped percentage for a usage bar, including a zero limit. */
export function billingUsagePercent(current: number, limit: number | null): number {
  if (limit === null || !Number.isFinite(current) || !Number.isFinite(limit) || limit <= 0) return current > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (current / limit) * 100));
}

function isOptionalNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
}

function isBillingMetric(value: unknown): value is BillingMetric {
  if (!value || typeof value !== 'object') return false;
  const metric = value as Record<string, unknown>;
  return typeof metric.current === 'number'
    && Number.isInteger(metric.current)
    && metric.current >= 0
    && isOptionalNonNegativeInteger(metric.limit)
    && typeof metric.allowed === 'boolean';
}

export function parseBillingSummary(value: unknown): BillingSummary | null {
  if (!value || typeof value !== 'object') return null;
  const summary = value as Record<string, unknown>;
  const subscription = summary.subscription;
  const plan = summary.plan;
  const metrics = summary.metrics;
  if (!subscription || typeof subscription !== 'object' || !plan || typeof plan !== 'object' || !metrics || typeof metrics !== 'object') return null;

  const subscriptionRecord = subscription as Record<string, unknown>;
  const planRecord = plan as Record<string, unknown>;
  const limits = planRecord.limits;
  const metricsRecord = metrics as Record<string, unknown>;
  if (!limits || typeof limits !== 'object') return null;
  const limitsRecord = limits as Record<string, unknown>;
  if (typeof subscriptionRecord.planId !== 'string' || typeof subscriptionRecord.status !== 'string'
    || typeof subscriptionRecord.currentPeriodStart !== 'string' || typeof subscriptionRecord.currentPeriodEnd !== 'string'
    || typeof planRecord.id !== 'string' || typeof planRecord.name !== 'string' || typeof planRecord.description !== 'string'
    || (planRecord.priceMonthly !== null && (typeof planRecord.priceMonthly !== 'number' || !Number.isFinite(planRecord.priceMonthly) || planRecord.priceMonthly < 0))
    || !isOptionalNonNegativeInteger(limitsRecord.maxRepositories)
    || !isOptionalNonNegativeInteger(limitsRecord.maxScansPerMonth)
    || !isOptionalNonNegativeInteger(limitsRecord.maxDraftPrsPerMonth)
    || !isBillingMetric(metricsRecord.repositories)
    || !isBillingMetric(metricsRecord.scans)
    || !isBillingMetric(metricsRecord.draftPrs)) return null;

  return value as BillingSummary;
}
