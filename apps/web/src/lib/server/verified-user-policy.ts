/**
 * Server-side verified-user policy boundary.
 *
 * This module deliberately does not read client claims or query a schema that
 * is not active on the integration branch. Route activation remains a separate
 * migration and policy decision.
 */
import { getDatabase } from './db/index.js';

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

/**
 * Read verification state from the active server schema. The email-verification
 * migration is intentionally not registered while migration 024 is ambiguous,
 * so callers must receive an explicit unavailable result instead of treating a
 * missing column as verified.
 */
export async function loadVerifiedUserPolicy(userId: string, action: VerifiedUserAction): Promise<VerifiedUserPolicyInput> {
  const db = getDatabase();
  const state = db.engine === 'postgres'
    ? await db.queryOne<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'`,
    )
    : (await db.query<{ name: string }>('PRAGMA table_info(users)')).find((column) => column.name === 'email_verified_at');

  if (!state) return { action, verificationStateAvailable: false };

  const user = await db.queryOne<{ email_verified_at: string | null }>(
    'SELECT email_verified_at FROM users WHERE id = ?',
    [userId],
  );
  return {
    action,
    verificationStateAvailable: true,
    emailVerifiedAt: user?.email_verified_at ?? null,
    providerVerified: false,
  };
}

export function verifiedUserFailure(decision: VerifiedUserDecision, action: VerifiedUserAction = 'provider_link'): { status: 403 | 503; code: 'EMAIL_VERIFICATION_REQUIRED' | 'VERIFICATION_STATE_UNAVAILABLE'; error: string } | null {
  if (decision === 'verification_unavailable') {
    return { status: 503, code: 'VERIFICATION_STATE_UNAVAILABLE', error: 'Account verification is temporarily unavailable.' };
  }
  if (decision === 'require_verification') {
    const actionText = action === 'workspace' ? 'before modifying workspace data' : action === 'authenticated_account' ? 'before modifying account data' : 'before connecting a provider';
    return { status: 403, code: 'EMAIL_VERIFICATION_REQUIRED', error: `Verify your email ${actionText}.` };
  }
  return null;
}
