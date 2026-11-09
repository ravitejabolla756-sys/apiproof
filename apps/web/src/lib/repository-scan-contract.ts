function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the successful repository-connection projection before starting a scan. */
export function parseRepositoryConnectionResponse(value: unknown): { repositoryId: string } | null {
  if (!record(value) || value.success !== true || !record(value.repository) || typeof value.repository.id !== 'string' || value.repository.id.trim().length === 0) return null;
  return { repositoryId: value.repository.id.trim() };
}

/** Validate the successful server-owned scan action projection. */
export function parseRepositoryScanResponse(value: unknown): { findingsCount: number } | null {
  if (!record(value) || !record(value.result)) return null;
  const findingsCount = value.result.findingsCount;
  return typeof findingsCount === 'number' && Number.isSafeInteger(findingsCount) && findingsCount >= 0 ? { findingsCount } : null;
}
