export type FindingRecommendedAction = 'NO_ACTION' | 'MANUAL_REVIEW' | 'MIGRATION_AVAILABLE' | 'MIGRATION_NOT_AVAILABLE';

export interface FindingListItem {
  id: string;
  provider: string;
  change_id: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  file_path: string;
  line_number: number;
  symbol: string;
  status: string;
  created_at: string;
  repo_name: string;
  repo_full_name: string;
  pr_number: number | null;
  pr_url: string | null;
  pr_state: string | null;
  capability: { migrationAvailable: boolean; recommendedNextAction: FindingRecommendedAction } | null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return text(value, maxLength);
}

function safeInteger(value: unknown, minimum = 0): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= minimum ? value as number : undefined;
}

function parseCapability(value: unknown): FindingListItem['capability'] | undefined {
  if (value === null) return null;
  const row = record(value);
  if (!row || typeof row.migrationAvailable !== 'boolean') return undefined;
  const action = row.recommendedNextAction;
  if (action !== 'NO_ACTION' && action !== 'MANUAL_REVIEW' && action !== 'MIGRATION_AVAILABLE' && action !== 'MIGRATION_NOT_AVAILABLE') return undefined;
  return { migrationAvailable: row.migrationAvailable, recommendedNextAction: action };
}

function parseFinding(value: unknown): FindingListItem | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const provider = text(row.provider, 256);
  const changeId = text(row.change_id, 256);
  const title = text(row.title, 512);
  const description = text(row.description, 4000);
  const severity = text(row.severity, 128);
  const confidence = typeof row.confidence === 'number' && Number.isFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1 ? row.confidence : undefined;
  const filePath = text(row.file_path, 2000);
  const lineNumber = safeInteger(row.line_number, 1);
  const symbol = text(row.symbol, 512);
  const status = text(row.status, 128);
  const createdAt = text(row.created_at, 128);
  const repoName = text(row.repo_name, 256);
  const repoFullName = text(row.repo_full_name, 512);
  const prNumber = row.pr_number === null ? null : safeInteger(row.pr_number, 1);
  const prUrl = nullableText(row.pr_url, 2048);
  const prState = nullableText(row.pr_state, 64);
  const capability = parseCapability(row.capability);
  if (!id || !provider || !changeId || !title || !description || !severity || confidence === undefined || !filePath || lineNumber === undefined || !symbol || !status || !createdAt || !repoName || !repoFullName || (row.pr_number !== null && prNumber === undefined) || prUrl === undefined || prState === undefined || capability === undefined) return undefined;
  if (prUrl !== null && !/^https:\/\//i.test(prUrl)) return undefined;
  const normalizedPrNumber: number | null = prNumber ?? null;
  return { id, provider, change_id: changeId, title, description, severity, confidence, file_path: filePath, line_number: lineNumber, symbol, status, created_at: createdAt, repo_name: repoName, repo_full_name: repoFullName, pr_number: normalizedPrNumber, pr_url: prUrl, pr_state: prState, capability };
}

export function parseFindingListResponse(value: unknown): FindingListItem[] | undefined {
  const payload = record(value);
  if (!payload || !Array.isArray(payload.findings) || payload.findings.length > 10000) return undefined;
  const findings = payload.findings.map(parseFinding);
  return findings.every((finding): finding is FindingListItem => Boolean(finding)) ? findings : undefined;
}
