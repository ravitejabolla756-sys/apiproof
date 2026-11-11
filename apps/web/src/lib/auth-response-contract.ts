type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Validate the explicit success marker returned by login and signup actions. */
export function parseAuthMutationSuccess(payload: unknown): boolean {
  return isRecord(payload) && payload.success === true;
}

/** Validate the boolean session projection used by public navigation. */
export function parseAuthenticatedSession(payload: unknown): boolean {
  return isRecord(payload) && payload.authenticated === true;
}

/** Read an authentication error without rendering malformed response values. */
export function parseAuthMutationError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') return fallback;
  const error = payload.error.trim();
  return error || fallback;
}

