type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the explicit success projection returned by the AUTH-05 action. */
export function parseEmailVerificationSuccess(payload: unknown): { message: string } | null {
  if (!isRecord(payload) || payload.success !== true || typeof payload.message !== 'string') return null;
  const message = payload.message.trim();
  return message ? { message } : null;
}

/** Extract a safe server error for invalid or expired verification links. */
export function parseEmailVerificationError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') return fallback;
  const error = payload.error.trim();
  return error || fallback;
}
