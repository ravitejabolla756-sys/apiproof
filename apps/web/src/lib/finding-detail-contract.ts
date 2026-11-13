export type FindingCapability = {
  source: 'productization';
  baselineSha: string | null;
  scanId: string | null;
  recommendedNextAction: 'NO_ACTION' | 'MANUAL_REVIEW' | 'MIGRATION_AVAILABLE' | 'MIGRATION_NOT_AVAILABLE';
  migrationAvailable: boolean;
  verificationAvailable: boolean;
  evidenceCoverage: 'complete' | 'partial' | 'insufficient' | null;
  reviewStatus: 'draft' | 'reviewed' | 'verified' | null;
  remediation: {
    mode: 'transform' | 'manual-guidance';
    templateId: string;
    limitation: string;
    summary: string;
    steps: string[];
    validation: string[];
  } | null;
};

export type FindingDetail = {
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
  reason: string;
  source_snippet: string | null;
  status: string;
  created_at: string;
  repo_name: string;
  repo_full_name: string;
  repo_owner: string;
  default_branch: string;
  evidence: Array<{ id: string; kind: string; label: string }>;
  reasonCodes: string[];
  capability: FindingCapability | null;
};

export type MigrationDetail = {
  id: string;
  plan_id: string;
  status: string;
  patch_diff: string;
  patch_digest: string;
  pr_number?: number;
  pr_url?: string;
  branch_name?: string;
  target_branch?: string;
  pr_state?: string;
  lifecycle_state?: 'Migration Planned' | 'Verification Pending' | 'Verification Passed' | 'Verification Failed' | 'Verification Unavailable' | 'Draft PR Created' | 'Pull Request Open' | 'Pull Request Closed' | 'Pull Request Merged' | 'Pull Request State Unavailable';
  verification_job_id?: string | null;
  verification_job_status?: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return text(value) ?? undefined;
}

function list(value: unknown, limit = 128): string[] | null {
  if (!Array.isArray(value) || value.length > limit || !value.every((item) => text(item))) return null;
  return value.map((item) => text(item)!);
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === 'string' && values.includes(value as T) ? value as T : null;
}

function parseCapability(value: unknown): FindingCapability | null | undefined {
  if (value === null || value === undefined) return value === null ? null : undefined;
  if (!record(value) || value.source !== 'productization' || typeof value.migrationAvailable !== 'boolean' || typeof value.verificationAvailable !== 'boolean') return undefined;
  const baselineSha = nullableText(value.baselineSha);
  const scanId = nullableText(value.scanId);
  const nextAction = oneOf(value.recommendedNextAction, ['NO_ACTION', 'MANUAL_REVIEW', 'MIGRATION_AVAILABLE', 'MIGRATION_NOT_AVAILABLE'] as const);
  const evidenceCoverage = value.evidenceCoverage === null ? null : oneOf(value.evidenceCoverage, ['complete', 'partial', 'insufficient'] as const);
  const reviewStatus = value.reviewStatus === null ? null : oneOf(value.reviewStatus, ['draft', 'reviewed', 'verified'] as const);
  if (baselineSha === undefined || scanId === undefined || !nextAction || evidenceCoverage === undefined || reviewStatus === undefined) return undefined;
  let remediation: FindingCapability['remediation'] = null;
  if (value.remediation !== null) {
    if (!record(value.remediation)) return undefined;
    const mode = oneOf(value.remediation.mode, ['transform', 'manual-guidance'] as const);
    const templateId = text(value.remediation.templateId);
    const limitation = text(value.remediation.limitation);
    const summary = text(value.remediation.summary);
    const steps = list(value.remediation.steps, 64);
    const validation = list(value.remediation.validation, 64);
    if (!mode || !templateId || !limitation || !summary || !steps || !validation) return undefined;
    remediation = { mode, templateId, limitation, summary, steps, validation };
  }
  return { source: 'productization', baselineSha, scanId, recommendedNextAction: nextAction, migrationAvailable: value.migrationAvailable,
    verificationAvailable: value.verificationAvailable, evidenceCoverage, reviewStatus, remediation };
}

function parseMigration(value: unknown): MigrationDetail | null | undefined {
  if (value === null || value === undefined) return value === null ? null : undefined;
  if (!record(value)) return undefined;
  const id = text(value.id); const plan_id = text(value.plan_id); const status = text(value.status);
  const patch_diff = typeof value.patch_diff === 'string' ? value.patch_diff : null;
  const patch_digest = text(value.patch_digest);
  if (!id || !plan_id || !status || patch_diff === null || !patch_digest) return undefined;
  const optionalText = (key: string): string | undefined => value[key] === undefined ? undefined : text(value[key]) ?? undefined;
  const prNumber = value.pr_number === undefined || value.pr_number === null ? undefined : (Number.isSafeInteger(value.pr_number) && Number(value.pr_number) > 0 ? Number(value.pr_number) : NaN);
  if (Number.isNaN(prNumber)) return undefined;
  const lifecycleValues = ['Migration Planned', 'Verification Pending', 'Verification Passed', 'Verification Failed', 'Verification Unavailable', 'Draft PR Created', 'Pull Request Open', 'Pull Request Closed', 'Pull Request Merged', 'Pull Request State Unavailable'] as const;
  const lifecycle = value.lifecycle_state === undefined ? undefined : oneOf(value.lifecycle_state, lifecycleValues);
  if (value.lifecycle_state !== undefined && !lifecycle) return undefined;
  const jobId = value.verification_job_id === undefined ? undefined : nullableText(value.verification_job_id);
  const jobStatus = value.verification_job_status === undefined ? undefined : nullableText(value.verification_job_status);
  if (jobId === undefined && value.verification_job_id !== undefined || jobStatus === undefined && value.verification_job_status !== undefined) return undefined;
  return { id, plan_id, status, patch_diff, patch_digest, ...(prNumber === undefined ? {} : { pr_number: prNumber }),
    ...(optionalText('pr_url') ? { pr_url: optionalText('pr_url') } : {}), ...(optionalText('branch_name') ? { branch_name: optionalText('branch_name') } : {}),
    ...(optionalText('target_branch') ? { target_branch: optionalText('target_branch') } : {}), ...(optionalText('pr_state') ? { pr_state: optionalText('pr_state') } : {}),
    ...(lifecycle ? { lifecycle_state: lifecycle } : {}), ...(value.verification_job_id !== undefined ? { verification_job_id: jobId! } : {}),
    ...(value.verification_job_status !== undefined ? { verification_job_status: jobStatus! } : {}) };
}

function parseFinding(value: unknown): FindingDetail | null {
  if (!record(value)) return null;
  const required = ['id', 'provider', 'change_id', 'title', 'description', 'severity', 'confidence', 'file_path', 'symbol', 'reason', 'status', 'created_at', 'repo_name', 'repo_full_name', 'repo_owner', 'default_branch'] as const;
  const fields = Object.fromEntries(required.map((key) => [key, text(value[key])])) as Record<string, string | null>;
  if (required.some((key) => !fields[key]) || !Number.isSafeInteger(value.line_number) || Number(value.line_number) < 1 || (value.source_snippet !== null && value.source_snippet !== undefined && typeof value.source_snippet !== 'string')) return null;
  if (!Array.isArray(value.evidence) || value.evidence.length > 256 || !value.evidence.every((item) => record(item) && text(item.id) && text(item.kind) && text(item.label))) return null;
  const reasonCodes = list(value.reasonCodes, 128); const capability = parseCapability(value.capability);
  if (!reasonCodes || capability === undefined) return null;
  return { ...(fields as Omit<FindingDetail, 'line_number' | 'source_snippet' | 'evidence' | 'reasonCodes' | 'capability'>), line_number: Number(value.line_number), source_snippet: value.source_snippet === null || value.source_snippet === undefined ? null : value.source_snippet,
    evidence: value.evidence.map((item) => ({ id: text((item as Record<string, unknown>).id)!, kind: text((item as Record<string, unknown>).kind)!, label: text((item as Record<string, unknown>).label)! })), reasonCodes, capability };
}

export function parseFindingDetailResponse(value: unknown): { finding: FindingDetail; migration: MigrationDetail | null } | null {
  if (!record(value)) return null;
  const finding = parseFinding(value.finding); const migration = parseMigration(value.migration);
  return finding && migration !== undefined ? { finding, migration: migration ?? null } : null;
}
