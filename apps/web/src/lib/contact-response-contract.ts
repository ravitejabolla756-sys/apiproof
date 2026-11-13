function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function parseContactSuccess(value: unknown): boolean {
  return record(value)?.success === true;
}

export function parseContactError(value: unknown, fallback: string): string {
  const error = record(value)?.error;
  if (typeof error !== 'string') return fallback;
  const message = error.trim();
  return message && message.length <= 512 ? message : fallback;
}
