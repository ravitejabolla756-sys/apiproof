export type RepositoryDetailResponse = {
  repository: {
    id: string;
    owner: string;
    name: string;
    full_name: string;
    github_repository_id: string;
    default_branch: string;
    status: string;
    last_scan_at: string | null;
    created_at: string;
  };
  scans: Array<{
    id: string;
    sha: string;
    status: string;
    files_analyzed: number;
    findings_count: number;
    started_at: string;
    completed_at: string | null;
  }>;
  findings: Array<{
    id: string;
    provider: string;
    change_id: string;
    title: string;
    description: string;
    severity: string;
    confidence: string | number;
    file_path: string;
    line_number: number;
    symbol: string;
    status: string;
    created_at: string;
  }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function nullableText(value: unknown): value is string | null {
  return value === null || text(value);
}

function isRepository(value: unknown): value is RepositoryDetailResponse['repository'] {
  if (!record(value)) return false;
  return text(value.id) && text(value.owner) && text(value.name) && text(value.full_name)
    && text(value.github_repository_id) && text(value.default_branch) && text(value.status)
    && nullableText(value.last_scan_at) && text(value.created_at);
}

function isScan(value: unknown): value is RepositoryDetailResponse['scans'][number] {
  if (!record(value)) return false;
  return text(value.id) && text(value.sha) && text(value.status) && count(value.files_analyzed)
    && count(value.findings_count) && text(value.started_at) && nullableText(value.completed_at);
}

function isFinding(value: unknown): value is RepositoryDetailResponse['findings'][number] {
  if (!record(value)) return false;
  return text(value.id) && text(value.provider) && text(value.change_id) && text(value.title)
    && text(value.description) && text(value.severity)
    && (text(value.confidence) || typeof value.confidence === 'number')
    && text(value.file_path) && count(value.line_number) && text(value.symbol)
    && text(value.status) && text(value.created_at);
}

/** Validate the repository detail envelope before dereferencing its collections. */
export function parseRepositoryDetailResponse(value: unknown): RepositoryDetailResponse | null {
  if (!record(value) || !isRepository(value.repository) || !Array.isArray(value.scans) || !Array.isArray(value.findings)) return null;
  if (!value.scans.every(isScan) || !value.findings.every(isFinding)) return null;
  return {
    repository: value.repository,
    scans: value.scans,
    findings: value.findings,
  };
}
