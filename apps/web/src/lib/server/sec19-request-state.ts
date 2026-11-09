export const SEC19_REQUEST_STATES = ['requested', 'processing', 'completed', 'failed', 'cancelled'] as const;
export type Sec19RequestState = typeof SEC19_REQUEST_STATES[number];

export const SEC19_OPERATIONS = ['account_closure', 'workspace_deletion'] as const;
export type Sec19Operation = typeof SEC19_OPERATIONS[number];

export const SEC19_OUTCOME_CODES = [
  'REQUEST_COMPLETED',
  'REQUEST_FAILED',
  'REQUEST_CANCELLED',
  'REQUEST_RETRYABLE_FAILURE',
] as const;
export type Sec19OutcomeCode = typeof SEC19_OUTCOME_CODES[number];

export interface Sec19RequestIdentity {
  workspaceId: string;
  subjectUserId: string;
  actorUserId: string;
  operation: Sec19Operation;
  idempotencyKey: string;
  policyVersion: string;
}

export interface Sec19RequestRecord extends Sec19RequestIdentity {
  requestId: string;
  state: Sec19RequestState;
  requestedAt: string;
  updatedAt: string;
  outcomeCode: Sec19OutcomeCode | null;
  auditReference: string | null;
}

export class Sec19RequestStateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'Sec19RequestStateError';
  }
}

const TRANSITIONS: Readonly<Record<Sec19RequestState, readonly Sec19RequestState[]>> = {
  requested: ['processing', 'cancelled'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['processing', 'cancelled'],
  cancelled: [],
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function assertSafeIdentifier(value: string, field: string): void {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new Sec19RequestStateError(`SEC19_INVALID_${field.toUpperCase()}`);
  }
}

export function assertSec19RequestIdentity(identity: Sec19RequestIdentity): void {
  assertSafeIdentifier(identity.workspaceId, 'workspace_id');
  assertSafeIdentifier(identity.subjectUserId, 'subject_user_id');
  assertSafeIdentifier(identity.actorUserId, 'actor_user_id');
  assertSafeIdentifier(identity.idempotencyKey, 'idempotency_key');
  assertSafeIdentifier(identity.policyVersion, 'policy_version');
  if (!SEC19_OPERATIONS.includes(identity.operation)) {
    throw new Sec19RequestStateError('SEC19_INVALID_OPERATION');
  }
}

/** Fails before mutation when an idempotency key is reused for another request. */
export function assertSec19IdempotencyMatch(existing: Sec19RequestRecord, requested: Sec19RequestIdentity): void {
  assertSec19RequestIdentity(requested);
  const matches = existing.workspaceId === requested.workspaceId
    && existing.subjectUserId === requested.subjectUserId
    && existing.actorUserId === requested.actorUserId
    && existing.operation === requested.operation
    && existing.idempotencyKey === requested.idempotencyKey
    && existing.policyVersion === requested.policyVersion;
  if (!matches) throw new Sec19RequestStateError('SEC19_IDEMPOTENCY_CONFLICT');
}

function assertOutcomeCode(outcomeCode: Sec19OutcomeCode | null): void {
  if (outcomeCode !== null && !SEC19_OUTCOME_CODES.includes(outcomeCode)) {
    throw new Sec19RequestStateError('SEC19_INVALID_OUTCOME_CODE');
  }
}

function assertAuditReference(auditReference: string | null): void {
  if (auditReference !== null) assertSafeIdentifier(auditReference, 'audit_reference');
}

export function transitionSec19Request(
  record: Sec19RequestRecord,
  nextState: Sec19RequestState,
  now: string,
  details: { outcomeCode?: Sec19OutcomeCode | null; auditReference?: string | null } = {},
): Sec19RequestRecord {
  assertSec19RequestIdentity(record);
  if (!Number.isFinite(Date.parse(now))) throw new Sec19RequestStateError('SEC19_INVALID_TIMESTAMP');
  assertOutcomeCode(details.outcomeCode ?? record.outcomeCode);
  assertAuditReference(details.auditReference ?? record.auditReference);

  if (nextState === record.state) {
    return {
      ...record,
      updatedAt: now,
      outcomeCode: details.outcomeCode ?? record.outcomeCode,
      auditReference: details.auditReference ?? record.auditReference,
    };
  }
  if (!SEC19_REQUEST_STATES.includes(nextState) || !TRANSITIONS[record.state].includes(nextState)) {
    throw new Sec19RequestStateError('SEC19_INVALID_STATE_TRANSITION');
  }
  const outcomeCode = details.outcomeCode ?? (nextState === 'completed' ? 'REQUEST_COMPLETED' : nextState === 'cancelled' ? 'REQUEST_CANCELLED' : record.outcomeCode);
  if ((nextState === 'completed' || nextState === 'failed' || nextState === 'cancelled') && outcomeCode === null) {
    throw new Sec19RequestStateError('SEC19_OUTCOME_REQUIRED');
  }
  return {
    ...record,
    state: nextState,
    updatedAt: now,
    outcomeCode,
    auditReference: details.auditReference ?? record.auditReference,
  };
}
