/**
 * Server-side verified-user policy boundary.
 *
 * This module deliberately does not read client claims or query a schema that
 * is not active on the integration branch. Route activation remains a separate
 * migration and policy decision.
 */
export type VerifiedUserAction =
  | 'onboarding'
  | 'recovery'
  | 'authenticated_account'
  | 'workspace'
  | 'provider_link';

export type VerifiedUserDecision = 'allow' | 'require_verification' | 'verification_unavailable';

export interface VerifiedUserPolicyInput {
  action: VerifiedUserAction;
  /** Server-derived users.email_verified_at; never accept this from a request body. */
  emailVerifiedAt?: string | null;
  /** True only when an approved provider has completed its own verification. */
  providerVerified?: boolean;
  /** Whether the reconciled verification column/service is available. */
  verificationStateAvailable: boolean;
}

const ALWAYS_AVAILABLE_ACTIONS = new Set<VerifiedUserAction>(['onboarding', 'recovery']);

function hasValidVerificationTimestamp(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

/**
 * Evaluate the centrally defined policy without changing route behavior.
 * Onboarding and recovery remain available; protected workspace/provider
 * actions fail closed when verification state is unavailable or unverified.
 */
export function evaluateVerifiedUserPolicy(input: VerifiedUserPolicyInput): VerifiedUserDecision {
  if (ALWAYS_AVAILABLE_ACTIONS.has(input.action)) return 'allow';
  if (!input.verificationStateAvailable) return 'verification_unavailable';
  if (input.providerVerified === true || hasValidVerificationTimestamp(input.emailVerifiedAt)) return 'allow';
  return 'require_verification';
}

export function assertVerifiedUser(input: VerifiedUserPolicyInput): void {
  const decision = evaluateVerifiedUserPolicy(input);
  if (decision === 'verification_unavailable') throw new Error('VERIFICATION_STATE_UNAVAILABLE');
  if (decision === 'require_verification') throw new Error('EMAIL_VERIFICATION_REQUIRED');
}
