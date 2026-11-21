function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readProviderRuleErrorCode(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function providerRuleErrorMessage(status: number, code: string | null, fallback: string): string {
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (status === 403 || code === 'WORKSPACE_CAPABILITY_DENIED' || code === 'CSRF_REJECTED') return 'You do not have permission to perform this review action.';
  if (status === 404 || code === 'PROVIDER_RULE_NOT_FOUND') return 'The provider rule is no longer available.';
  if (status === 503 || code?.endsWith('_SCHEMA_UNAVAILABLE') || code === 'PROVIDER_SOURCE_UNAVAILABLE') return 'Provider review is temporarily unavailable.';
  return fallback;
}
