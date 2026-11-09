function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the successful server-owned scan action projection. */
export function parseRepositoryScanResponse(value: unknown): { findingsCount: number } | null {
  if (!record(value) || !record(value.result)) return null;
  const findingsCount = value.result.findingsCount;
  return typeof findingsCount === 'number' && Number.isSafeInteger(findingsCount) && findingsCount >= 0 ? { findingsCount } : null;
}
