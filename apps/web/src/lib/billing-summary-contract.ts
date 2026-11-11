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
// eof
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
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isBillingMetric(value: unknown): value is BillingMetric {
  if (!value || typeof value !== 'object') return false;
  const metric = value as Record<string, unknown>;
  return typeof metric.current === 'number'
    && Number.isSafeInteger(metric.current)
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
  const planId = normalizedText(subscriptionRecord.planId);
  const subscriptionStatus = normalizedText(subscriptionRecord.status);
  const currentPeriodStart = normalizedText(subscriptionRecord.currentPeriodStart);
  const currentPeriodEnd = normalizedText(subscriptionRecord.currentPeriodEnd);
  const planIdValue = normalizedText(planRecord.id);
  const planName = normalizedText(planRecord.name);
  const planDescription = normalizedText(planRecord.description);
  if (!planId || !subscriptionStatus || !currentPeriodStart || !currentPeriodEnd
    || !planIdValue || !planName || !planDescription
    || (planRecord.priceMonthly !== null && (typeof planRecord.priceMonthly !== 'number' || !Number.isFinite(planRecord.priceMonthly) || planRecord.priceMonthly < 0))
    || !isOptionalNonNegativeInteger(limitsRecord.maxRepositories)
    || !isOptionalNonNegativeInteger(limitsRecord.maxScansPerMonth)
    || !isOptionalNonNegativeInteger(limitsRecord.maxDraftPrsPerMonth)
    || !isBillingMetric(metricsRecord.repositories)
    || !isBillingMetric(metricsRecord.scans)
    || !isBillingMetric(metricsRecord.draftPrs)) return null;

  return {
    subscription: {
      planId,
      status: subscriptionStatus,
      currentPeriodStart,
      currentPeriodEnd,
    },
    plan: {
      id: planIdValue,
      name: planName,
      description: planDescription,
      priceMonthly: planRecord.priceMonthly as number | null,
      limits: {
        maxRepositories: limitsRecord.maxRepositories as number | null,
        maxScansPerMonth: limitsRecord.maxScansPerMonth as number | null,
        maxDraftPrsPerMonth: limitsRecord.maxDraftPrsPerMonth as number | null,
      },
    },
    metrics: {
      repositories: metricsRecord.repositories as BillingMetric,
      scans: metricsRecord.scans as BillingMetric,
      draftPrs: metricsRecord.draftPrs as BillingMetric,
    },
  };
}

