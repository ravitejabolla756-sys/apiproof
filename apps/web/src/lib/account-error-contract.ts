function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readAccountErrorCode(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function accountErrorMessage(status: number, code: string | null, fallback: string): string {
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (code === 'ACCOUNT_NOT_FOUND') return 'Your account is unavailable. Please sign in again.';
  if (code === 'INVALID_CURRENT_PASSWORD') return 'The current password is incorrect.';
  if (code === 'EMAIL_VERIFICATION_REQUIRED') return 'Verify your email before using this account action.';
  if (code === 'VERIFICATION_STATE_UNAVAILABLE') return 'Account verification is temporarily unavailable.';
  if (code === 'EMAIL_VERIFICATION_UNAVAILABLE') return 'Email verification is temporarily unavailable.';
  if (code === 'DELETION_CONTRACT_PENDING' || code === 'DELETION_PLAN_UNAVAILABLE') {
    return 'Account deletion is not currently available.';
  }
  return fallback;
}
