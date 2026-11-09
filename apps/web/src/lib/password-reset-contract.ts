type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the explicit success projection used by password-reset actions. */
export function parsePasswordResetSuccess(payload: unknown): { message: string } | null {
  if (!isRecord(payload) || payload.success !== true || typeof payload.message !== 'string') return null;
  const message = payload.message.trim();
  return message ? { message } : null;
}

/** Read a server error without allowing malformed JSON to become user-facing text. */
export function parsePasswordResetError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') return fallback;
  const error = payload.error.trim();
  return error || fallback;
}
