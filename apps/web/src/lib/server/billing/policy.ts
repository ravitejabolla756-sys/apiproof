import type { BillingSubscriptionStatus } from './provider.js';

export const BILLING_POLICY_RECIPIENTS = [
  'billing_owner',
  'workspace_owner',
  'workspace_admin',
] as const;

export type BillingPolicyRecipient = (typeof BILLING_POLICY_RECIPIENTS)[number];

export interface ApprovedBillingGracePolicy {
  approved: true;
  gracePeriodMs: number;
  retryCadenceMs: number;
  suspensionTrigger: 'past_due_after_grace';
  notificationRecipients: readonly BillingPolicyRecipient[];
  readOnlyDuringGrace: boolean;
}

export type BillingPolicyEvaluation =
  | {
      status: 'active';
      mutationsAllowed: true;
      readOnly: false;
      reason: 'SUBSCRIPTION_ACTIVE';
    }
  | {
      status: 'grace' | 'suspended' | 'policy_unavailable' | 'provider_unavailable';
      mutationsAllowed: false;
      readOnly: true;
      reason:
        | 'PAYMENT_GRACE_PERIOD'
        | 'PAYMENT_GRACE_EXPIRED'
        | 'BILLING_POLICY_UNAVAILABLE'
        | 'BILLING_PROVIDER_UNAVAILABLE'
        | 'SUBSCRIPTION_CANCELED';
      graceEndsAt?: string;
    };

export interface BillingPolicyEvaluationInput {
  subscriptionStatus: BillingSubscriptionStatus;
  now: Date;
  providerUnavailable?: boolean;
  paymentFailedAt?: Date;
  policy?: ApprovedBillingGracePolicy | null;
}

const RECIPIENT_SET = new Set<string>(BILLING_POLICY_RECIPIENTS);
const MAX_GRACE_PERIOD_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_RETRY_CADENCE_MS = 30 * 24 * 60 * 60 * 1000;

function isFinitePositiveNumber(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= maximum;
}

/**
 * Validates owner-approved policy input without selecting business values.
 * Missing, malformed, or unapproved policy input returns null so callers
 * cannot silently enable an entitlement or suspension policy.
 */
export function parseApprovedBillingGracePolicy(input: unknown): ApprovedBillingGracePolicy | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  const recipients = candidate.notificationRecipients;

  if (
    candidate.approved !== true ||
    !isFinitePositiveNumber(candidate.gracePeriodMs, MAX_GRACE_PERIOD_MS) ||
    !isFinitePositiveNumber(candidate.retryCadenceMs, MAX_RETRY_CADENCE_MS) ||
    candidate.suspensionTrigger !== 'past_due_after_grace' ||
    typeof candidate.readOnlyDuringGrace !== 'boolean' ||
    !Array.isArray(recipients) ||
    recipients.length === 0 ||
    recipients.some((recipient) => typeof recipient !== 'string' || !RECIPIENT_SET.has(recipient))
  ) {
    return null;
  }

  return {
    approved: true,
    gracePeriodMs: candidate.gracePeriodMs,
    retryCadenceMs: candidate.retryCadenceMs,
    suspensionTrigger: 'past_due_after_grace',
    notificationRecipients: [...new Set(recipients)] as BillingPolicyRecipient[],
    readOnlyDuringGrace: candidate.readOnlyDuringGrace,
  };
}

/**
 * Evaluates a proposed grace/suspension policy without changing live billing
 * entitlements. This pure boundary is intentionally not wired into the
 * subscription service until the owner-approved policy and database evidence
 * exist. Provider outages never become suspension evidence.
 */
export function evaluateBillingGracePolicy(input: BillingPolicyEvaluationInput): BillingPolicyEvaluation {
  if (input.providerUnavailable) {
    return {
      status: 'provider_unavailable',
      mutationsAllowed: false,
      readOnly: true,
      reason: 'BILLING_PROVIDER_UNAVAILABLE',
    };
  }

  if (input.subscriptionStatus === 'active' || input.subscriptionStatus === 'trialing') {
    return {
      status: 'active',
      mutationsAllowed: true,
      readOnly: false,
      reason: 'SUBSCRIPTION_ACTIVE',
    };
  }

  if (input.subscriptionStatus === 'canceled') {
    return {
      status: 'suspended',
      mutationsAllowed: false,
      readOnly: true,
      reason: 'SUBSCRIPTION_CANCELED',
    };
  }

  if (input.subscriptionStatus !== 'past_due' && input.subscriptionStatus !== 'unpaid') {
    return {
      status: 'policy_unavailable',
      mutationsAllowed: false,
      readOnly: true,
      reason: 'BILLING_POLICY_UNAVAILABLE',
    };
  }

  if (!input.policy || !input.paymentFailedAt) {
    return {
      status: 'policy_unavailable',
      mutationsAllowed: false,
      readOnly: true,
      reason: 'BILLING_POLICY_UNAVAILABLE',
    };
  }

  const graceEndsAt = new Date(input.paymentFailedAt.getTime() + input.policy.gracePeriodMs);
  if (input.now.getTime() < graceEndsAt.getTime()) {
    return {
      status: 'grace',
      mutationsAllowed: false,
      readOnly: true,
      reason: 'PAYMENT_GRACE_PERIOD',
      graceEndsAt: graceEndsAt.toISOString(),
    };
  }

  return {
    status: 'suspended',
    mutationsAllowed: false,
    readOnly: true,
    reason: 'PAYMENT_GRACE_EXPIRED',
    graceEndsAt: graceEndsAt.toISOString(),
  };
}
