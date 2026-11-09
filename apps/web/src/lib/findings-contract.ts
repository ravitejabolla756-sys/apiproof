export type FindingProjection = {
  id: string;
  provider: string;
  change_id: string;
  title: string;
  description: string;
  severity: string;
  confidence: string;
  file_path: string;
  line_number: number;
  symbol: string;
  status: string;
  created_at: string;
  repo_name: string;
  repo_full_name: string;
  pr_number?: number | null;
  pr_url?: string | null;
  pr_state?: string | null;
  capability?: {
    migrationAvailable: boolean;
    recommendedNextAction: 'NO_ACTION' | 'MANUAL_REVIEW' | 'MIGRATION_AVAILABLE' | 'MIGRATION_NOT_AVAILABLE';
  } | null;
};

const actions = new Set<NonNullable<FindingProjection['capability']>['recommendedNextAction']>(['NO_ACTION', 'MANUAL_REVIEW', 'MIGRATION_AVAILABLE', 'MIGRATION_NOT_AVAILABLE']);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

/** Validate the server-owned findings collection before filtering or rendering it. */
export function parseFindingCollection(payload: unknown): FindingProjection[] | null {
  if (!record(payload) || !Array.isArray(payload.findings)) return null;
  const seen = new Set<string>();
  const findings: FindingProjection[] = [];
  for (const item of payload.findings) {
    if (!record(item) || typeof item.line_number !== 'number' || !Number.isSafeInteger(item.line_number) || item.line_number < 1) return null;
    const id = text(item.id);
    const provider = text(item.provider);
    const changeId = text(item.change_id);
    const title = text(item.title);
    const description = text(item.description);
    const severity = text(item.severity);
    const confidence = typeof item.confidence === 'string' || typeof item.confidence === 'number' ? String(item.confidence).trim() : null;
    const filePath = text(item.file_path);
    const symbol = text(item.symbol);
    const status = text(item.status);
    const createdAt = text(item.created_at);
    const repoName = text(item.repo_name);
    const repoFullName = text(item.repo_full_name);
    const capability = item.capability === undefined ? undefined : item.capability;
    const invalidCapability = capability !== undefined && capability !== null
      && (!record(capability) || typeof capability.migrationAvailable !== 'boolean' || typeof capability.recommendedNextAction !== 'string'
        || !actions.has(capability.recommendedNextAction as NonNullable<FindingProjection['capability']>['recommendedNextAction']));
    const invalidPullRequest = item.pr_number !== undefined && item.pr_number !== null
      && (typeof item.pr_number !== 'number' || !Number.isSafeInteger(item.pr_number) || item.pr_number < 1);
    if (!id || !provider || !changeId || !title || !description || !severity || !confidence || !filePath || !symbol || !status || !createdAt || !repoName || !repoFullName || seen.has(id) || invalidPullRequest || invalidCapability) return null;
    const prNumber = item.pr_number as number | null | undefined;
    seen.add(id);
    findings.push({
      id, provider, change_id: changeId, title, description, severity, confidence, file_path: filePath, line_number: item.line_number,
      symbol, status, created_at: createdAt, repo_name: repoName, repo_full_name: repoFullName,
      ...(prNumber === undefined ? {} : { pr_number: prNumber }),
      pr_url: optionalText(item.pr_url),
      ...(item.pr_state === undefined ? {} : { pr_state: optionalText(item.pr_state) }),
      ...(capability === undefined ? {} : { capability: capability === null ? null : capability as NonNullable<FindingProjection['capability']> }),
    });
  }
  return findings;
}
