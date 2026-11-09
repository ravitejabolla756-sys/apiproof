type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isMigration(value: unknown): value is RecordValue {
  return isRecord(value) && !!text(value.id) && !!text(value.status) && typeof value.patch_diff === 'string' && typeof value.patch_digest === 'string';
}

function isProposal(value: unknown): value is { number: number; state: string; branchName: string } {
  return isRecord(value) && typeof value.number === 'number' && Number.isSafeInteger(value.number) && value.number > 0
    && !!text(value.state) && !!text(value.branchName);
}

function isJob(value: unknown): value is { id: string; status: string; proposal?: { number: number; state: string; branchName: string } } {
  return isRecord(value) && !!text(value.id) && !!text(value.status)
    && (value.proposal === undefined || value.proposal === null || isProposal(value.proposal));
}

/** Validate the explicit migration-plan success envelope before updating the workbench. */
export function parseMigrationPlanResponse(payload: unknown): { migration: RecordValue } | null {
  if (!isRecord(payload) || payload.success !== true || !isMigration(payload.migration)) return null;
  return { migration: payload.migration };
}

/** Validate a proposal response, which must contain either a proposal or an async job. */
export function parseMigrationProposalResponse(payload: unknown): { proposal?: { number: number; state: string; branchName: string }; job?: { id: string; status: string } } | null {
  if (!isRecord(payload) || payload.success !== true) return null;
  if (payload.proposal !== undefined && payload.proposal !== null && !isProposal(payload.proposal)) return null;
  if (payload.job !== undefined && payload.job !== null && !isJob(payload.job)) return null;
  if (!payload.proposal && !payload.job) return null;
  return {
    ...(payload.proposal ? { proposal: payload.proposal } : {}),
    ...(payload.job ? { job: { id: payload.job.id, status: payload.job.status } } : {}),
  };
}

/** Validate the polling envelope before applying a verification status update. */
export function parseMigrationVerificationResponse(payload: unknown): { status: string; proposal?: { number: number; state: string; branchName: string } } | null {
  if (!isRecord(payload) || !isJob(payload)) return null;
  return {
    status: payload.status,
    ...(payload.proposal ? { proposal: payload.proposal } : {}),
  };
}

export function parseMigrationActionError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') return fallback;
  const error = payload.error.trim();
  return error || fallback;
}
