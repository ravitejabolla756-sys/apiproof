export type FindingDetailEnvelope = {
  finding: Record<string, unknown> | null;
  migration: Record<string, unknown> | null;
  error?: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFinding(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  return text(value.id) && text(value.provider) && text(value.change_id) && text(value.title)
    && text(value.description) && text(value.severity)
    && (typeof value.confidence === 'string' || typeof value.confidence === 'number')
    && text(value.file_path) && typeof value.line_number === 'number'
    && Number.isSafeInteger(value.line_number) && value.line_number > 0
    && text(value.symbol) && text(value.reason) && (value.source_snippet === null || text(value.source_snippet))
    && text(value.status) && text(value.created_at) && text(value.repo_name)
    && text(value.repo_full_name) && text(value.repo_owner) && text(value.default_branch)
    && Array.isArray(value.evidence) && Array.isArray(value.reasonCodes)
    && (value.capability === null || value.capability === undefined || record(value.capability));
}

function isMigration(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  return text(value.id) && text(value.status) && text(value.patch_diff) && text(value.patch_digest);
}

/** Validate the finding workbench envelope while allowing its explicit not-found shape. */
export function parseFindingDetailResponse(value: unknown): FindingDetailEnvelope | null {
  if (!record(value) || !('finding' in value) || !('migration' in value)) return null;
  if (value.finding !== null && !isFinding(value.finding)) return null;
  if (value.migration !== null && !isMigration(value.migration)) return null;
  if (value.error !== undefined && !text(value.error)) return null;
  return {
    finding: value.finding,
    migration: value.migration,
    ...(value.error === undefined ? {} : { error: value.error }),
  };
}
