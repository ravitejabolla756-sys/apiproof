import { describe, expect, it } from 'vitest';
import { billingUsagePercent, parseBillingSummary } from '../apps/web/src/lib/billing-summary-contract.js';

const validSummary = {
  subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
  plan: { id: 'free', name: 'Free', description: 'Fixture', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } },
  metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } },
};

describe('billing summary contract boundary', () => {
  it('accepts the canonical beta projection', () => {
    expect(parseBillingSummary(validSummary)).toEqual(validSummary);
  });

  it('rejects malformed numeric projections instead of producing invalid progress values', () => {
    expect(parseBillingSummary({ ...validSummary, metrics: { ...validSummary.metrics, scans: { current: Number.NaN, limit: 10, allowed: true } } })).toBeNull();
    expect(parseBillingSummary({ ...validSummary, plan: { ...validSummary.plan, limits: { ...validSummary.plan.limits, maxRepositories: -1 } } })).toBeNull();
  });

  it('normalizes billing text and preserves malformed periods for safe display', () => {
    expect(parseBillingSummary({
      ...validSummary,
      subscription: { ...validSummary.subscription, planId: ' free ', status: ' beta ' },
      plan: { ...validSummary.plan, id: ' free ', name: ' Free ', description: ' Fixture ' },
    })).toEqual(validSummary);
    expect(parseBillingSummary({ ...validSummary, subscription: { ...validSummary.subscription, currentPeriodEnd: '2026-02-31T00:00:00.000Z' } })).toMatchObject({ subscription: { currentPeriodEnd: '2026-02-31T00:00:00.000Z' } });
    expect(parseBillingSummary({ ...validSummary, plan: { ...validSummary.plan, name: '   ' } })).toBeNull();
    expect(parseBillingSummary({ ...validSummary, metrics: { ...validSummary.metrics, scans: { current: Number.MAX_SAFE_INTEGER + 1, limit: 10, allowed: true } } })).toBeNull();
  });

  it('keeps usage-bar widths finite when a beta metric has a zero limit', () => {
    expect(billingUsagePercent(0, 0)).toBe(0);
    expect(billingUsagePercent(1, 0)).toBe(100);
    expect(billingUsagePercent(5, 10)).toBe(50);
    expect(billingUsagePercent(15, 10)).toBe(100);
  });
});
