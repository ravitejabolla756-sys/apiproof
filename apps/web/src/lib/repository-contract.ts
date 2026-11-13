export interface RepositoryDetail {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
  status: string;
  last_scan_at: string | null;
  created_at: string;
}

export interface ScanRecord {
  id: string;
  sha: string;
  status: string;
  files_analyzed: number;
  findings_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface FindingRecord {
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
}

const MAX_SCANS = 64;
const MAX_FINDINGS = 10000;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return text(value, maxLength);
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function parseRepository(value: unknown): RepositoryDetail | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const owner = text(row.owner, 256);
  const name = text(row.name, 256);
  const fullName = text(row.full_name, 512);
  const githubRepositoryId = text(row.github_repository_id, 256);
  const defaultBranch = text(row.default_branch, 256);
  const status = text(row.status, 128);
  const lastScanAt = nullableText(row.last_scan_at, 128);
  const createdAt = text(row.created_at, 128);
  return id && owner && name && fullName && githubRepositoryId && defaultBranch && status && lastScanAt !== undefined && createdAt
    ? { id, owner, name, full_name: fullName, github_repository_id: githubRepositoryId, default_branch: defaultBranch, status, last_scan_at: lastScanAt, created_at: createdAt }
    : undefined;
}

function parseScan(value: unknown): ScanRecord | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const sha = text(row.sha, 256);
  const status = text(row.status, 128);
  const filesAnalyzed = nonNegativeInteger(row.files_analyzed);
  const findingsCount = nonNegativeInteger(row.findings_count);
  const startedAt = text(row.started_at, 128);
  const completedAt = nullableText(row.completed_at, 128);
  return id && sha && status && filesAnalyzed !== undefined && findingsCount !== undefined && startedAt && completedAt !== undefined
    ? { id, sha, status, files_analyzed: filesAnalyzed, findings_count: findingsCount, started_at: startedAt, completed_at: completedAt }
    : undefined;
}

function parseFinding(value: unknown): FindingRecord | undefined {
  const row = record(value);
  if (!row) return undefined;
  const fields = {
    id: text(row.id, 256),
    provider: text(row.provider, 256),
    change_id: text(row.change_id, 256),
    title: text(row.title, 512),
    description: text(row.description, 4000),
    severity: text(row.severity, 128),
    confidence: text(row.confidence, 128),
    file_path: text(row.file_path, 2000),
    line_number: nonNegativeInteger(row.line_number),
    symbol: text(row.symbol, 512),
    status: text(row.status, 128),
    created_at: text(row.created_at, 128),
  };
  return Object.values(fields).every((field) => field !== undefined)
    ? fields as FindingRecord
    : undefined;
}

export function parseRepositoryDetailResponse(value: unknown): { repository: RepositoryDetail; scans: ScanRecord[]; findings: FindingRecord[] } | undefined {
  const payload = record(value);
  if (!payload || !Array.isArray(payload.scans) || !Array.isArray(payload.findings) || payload.scans.length > MAX_SCANS || payload.findings.length > MAX_FINDINGS) return undefined;
  const repository = parseRepository(payload.repository);
  const scans = payload.scans.map(parseScan);
  const findings = payload.findings.map(parseFinding);
  return repository && scans.every((scan): scan is ScanRecord => Boolean(scan)) && findings.every((finding): finding is FindingRecord => Boolean(finding))
    ? { repository, scans, findings }
    : undefined;
}

export function parseScanActionResponse(value: unknown): number | undefined {
  const payload = record(value);
  const result = payload ? record(payload.result) : undefined;
  const findingsCount = result?.findingsCount;
  return nonNegativeInteger(findingsCount);
}
