import { describe, expect, it } from 'vitest';
import {
  evaluateBillingGracePolicy,
  parseApprovedBillingGracePolicy,
} from '../apps/web/src/lib/server/billing/policy.js';

const paymentFailedAt = new Date('2026-11-01T00:00:00.000Z');
const approvedPolicy = {
  approved: true,
  gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
  retryCadenceMs: 24 * 60 * 60 * 1000,
  suspensionTrigger: 'past_due_after_grace',
  notificationRecipients: ['billing_owner', 'workspace_owner'],
  readOnlyDuringGrace: true,
} as const;

describe('BILL-10 billing grace and suspension boundary', () => {
  it('preserves active and trialing access decisions', () => {
    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'active',
      now: paymentFailedAt,
    })).toMatchObject({ status: 'active', mutationsAllowed: true });
    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'trialing',
      now: paymentFailedAt,
    })).toMatchObject({ status: 'active', mutationsAllowed: true });
  });

  it('preserves the existing canceled-subscription suspension boundary', () => {
    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'canceled',
      now: paymentFailedAt,
    })).toMatchObject({ status: 'suspended', reason: 'SUBSCRIPTION_CANCELED', mutationsAllowed: false });
  });

  it('fails closed for past-due state without an approved policy', () => {
    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'past_due',
      now: paymentFailedAt,
      paymentFailedAt,
    })).toMatchObject({
      status: 'policy_unavailable',
      reason: 'BILLING_POLICY_UNAVAILABLE',
      mutationsAllowed: false,
      readOnly: true,
    });
  });

  it('does not suspend a workspace because the billing provider is unavailable', () => {
    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'past_due',
      now: new Date('2026-12-01T00:00:00.000Z'),
      providerUnavailable: true,
      paymentFailedAt,
      policy: parseApprovedBillingGracePolicy(approvedPolicy),
    })).toMatchObject({
      status: 'provider_unavailable',
      reason: 'BILLING_PROVIDER_UNAVAILABLE',
      mutationsAllowed: false,
      readOnly: true,
    });
  });

  it('evaluates an owner-approved synthetic policy within and after grace', () => {
    const policy = parseApprovedBillingGracePolicy(approvedPolicy);
    expect(policy).not.toBeNull();

    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'past_due',
      now: new Date('2026-11-03T00:00:00.000Z'),
      paymentFailedAt,
      policy,
    })).toMatchObject({ status: 'grace', mutationsAllowed: false, readOnly: true });

    expect(evaluateBillingGracePolicy({
      subscriptionStatus: 'unpaid',
      now: new Date('2026-11-09T00:00:00.000Z'),
      paymentFailedAt,
      policy,
    })).toMatchObject({ status: 'suspended', reason: 'PAYMENT_GRACE_EXPIRED', mutationsAllowed: false });
  });

  it('rejects missing, malformed, unapproved, and unsafe policy values', () => {
    expect(parseApprovedBillingGracePolicy(undefined)).toBeNull();
    expect(parseApprovedBillingGracePolicy({ ...approvedPolicy, approved: false })).toBeNull();
    expect(parseApprovedBillingGracePolicy({ ...approvedPolicy, notificationRecipients: ['unknown'] })).toBeNull();
    expect(parseApprovedBillingGracePolicy({ ...approvedPolicy, gracePeriodMs: 0 })).toBeNull();
    expect(parseApprovedBillingGracePolicy({ ...approvedPolicy, retryCadenceMs: 31 * 24 * 60 * 60 * 1000 })).toBeNull();
  });
});
