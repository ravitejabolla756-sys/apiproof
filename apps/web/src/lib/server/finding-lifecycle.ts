import crypto from 'node:crypto';
import type { DatabaseAdapter } from './db/types.js';

export const FINDING_LIFECYCLE_STATES = [
  'open',
  'acknowledged',
  'remediating',
  'fixed_pending_verification',
  'verified_resolved',
  'reopened',
  'resolved_legacy',
] as const;

export type FindingLifecycleState = typeof FINDING_LIFECYCLE_STATES[number];

const ALLOWED_TRANSITIONS: Record<FindingLifecycleState, readonly FindingLifecycleState[]> = {
  open: ['acknowledged', 'remediating', 'verified_resolved'],
  acknowledged: ['remediating', 'reopened', 'verified_resolved'],
  remediating: ['fixed_pending_verification', 'verified_resolved', 'reopened'],
  fixed_pending_verification: ['verified_resolved', 'reopened'],
  verified_resolved: ['reopened'],
  reopened: ['acknowledged', 'remediating', 'verified_resolved'],
  resolved_legacy: ['reopened', 'verified_resolved'],
};

export const LEGACY_STATUS_BY_STATE: Record<FindingLifecycleState, string> = {
  open: 'open',
  acknowledged: 'open',
  remediating: 'migration_planned',
  fixed_pending_verification: 'pr_created',
  verified_resolved: 'resolved',
  reopened: 'open',
  resolved_legacy: 'resolved',
};

interface FindingLifecycleRow {
  id: string;
  repository_id: string;
  workspace_id: string;
  lifecycle_state: FindingLifecycleState | null;
}

export interface FindingLifecycleTransition {
  findingId: string;
  workspaceId: string;
  toState: FindingLifecycleState;
  reason: string;
  idempotencyKey: string;
  actorUserId?: string;
  evidence?: { scanId?: string; baselineSha?: string; pullRequestId?: string; details?: Record<string, unknown> };
}

function assertState(state: string): asserts state is FindingLifecycleState {
  if (!(FINDING_LIFECYCLE_STATES as readonly string[]).includes(state)) throw new Error(`FINDING_LIFECYCLE_STATE_INVALID: ${state}`);
}

async function getFinding(db: DatabaseAdapter, findingId: string): Promise<FindingLifecycleRow | undefined> {
  const row = await db.queryOne<FindingLifecycleRow>(`
    SELECT f.id, f.repository_id, r.workspace_id, COALESCE(f.lifecycle_state, 'open') AS lifecycle_state
    FROM findings f JOIN repositories r ON r.id = f.repository_id
    WHERE f.id = ?
  `, [findingId]);
  if (row?.lifecycle_state) assertState(row.lifecycle_state);
  return row;
}

function requireTransition(from: FindingLifecycleState, to: FindingLifecycleState): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`FINDING_LIFECYCLE_TRANSITION_REJECTED: ${from} -> ${to}`);
  }
}

export interface FindingTransitionEvaluationInput {
  currentState: string;
  targetState: string;
  findingWorkspaceId: string;
  requestedWorkspaceId: string;
  hasResolutionEvidence?: boolean;
}

/**
 * Pure lifecycle policy boundary. Persistence callers must still perform the
 * conditional update and record the idempotency event in one transaction.
 */
export function evaluateFindingTransition(input: FindingTransitionEvaluationInput): {
  changed: boolean;
  state: FindingLifecycleState;
  legacyStatus: string;
} {
  assertState(input.currentState);
  assertState(input.targetState);
  if (input.findingWorkspaceId !== input.requestedWorkspaceId) throw new Error('FINDING_WORKSPACE_MISMATCH');
  const currentState = input.currentState;
  const targetState = input.targetState;
  if (currentState === targetState) return { changed: false, state: currentState, legacyStatus: LEGACY_STATUS_BY_STATE[currentState] };
  requireTransition(currentState, targetState);
  if (targetState === 'verified_resolved' && input.hasResolutionEvidence !== true) {
    throw new Error('FINDING_RESOLUTION_EVIDENCE_REQUIRED: completed scan evidence is required');
  }
  return { changed: true, state: targetState, legacyStatus: LEGACY_STATUS_BY_STATE[targetState] };
}

function requireResolutionEvidence(db: DatabaseAdapter, findingId: string, evidence: FindingLifecycleTransition['evidence']): Promise<void> {
  if (!evidence?.scanId) throw new Error('FINDING_RESOLUTION_EVIDENCE_REQUIRED: completed scan evidence is required');
  return db.queryOne<{ status: string }>('SELECT status FROM scans WHERE id = ? AND repository_id = (SELECT repository_id FROM findings WHERE id = ?)', [evidence.scanId, findingId])
    .then((scan) => {
      if (scan?.status !== 'completed') throw new Error('FINDING_RESOLUTION_EVIDENCE_INVALID: scan must be completed for verified resolution');
    });
}

export async function recordFindingCreated(db: DatabaseAdapter, params: { findingId: string; repositoryId: string; workspaceId: string; actorUserId?: string; scanId: string }): Promise<void> {
  const idempotencyKey = `finding:${params.findingId}:scan:${params.scanId}:created`;
  const existing = await db.queryOne<{ finding_id: string; repository_id: string; workspace_id: string; to_state: string }>(
    'SELECT finding_id, repository_id, workspace_id, to_state FROM finding_lifecycle_events WHERE idempotency_key = ?',
    [idempotencyKey],
  );
  if (existing) {
    if (existing.finding_id !== params.findingId || existing.repository_id !== params.repositoryId || existing.workspace_id !== params.workspaceId || existing.to_state !== 'open') {
      throw new Error('FINDING_LIFECYCLE_IDEMPOTENCY_CONFLICT');
    }
    return;
  }
  await db.execute(`
    INSERT INTO finding_lifecycle_events (id, finding_id, repository_id, workspace_id, actor_user_id, from_state, to_state, reason, evidence_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, 'open', 'finding_detected', ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING
  `, [
    `fle_${crypto.randomBytes(12).toString('hex')}`,
    params.findingId,
    params.repositoryId,
    params.workspaceId,
    params.actorUserId ?? null,
    JSON.stringify({ scanId: params.scanId }),
    idempotencyKey,
    new Date().toISOString(),
  ]);
}

export async function transitionFindingInTransaction(db: DatabaseAdapter, transition: FindingLifecycleTransition): Promise<{ changed: boolean; state: FindingLifecycleState }> {
  if (!transition.findingId || !transition.workspaceId || !transition.reason.trim() || !transition.idempotencyKey.trim()) {
    throw new Error('FINDING_LIFECYCLE_INPUT_INVALID');
  }
  assertState(transition.toState);

  const finding = await getFinding(db, transition.findingId);
  if (!finding) throw new Error('FINDING_NOT_FOUND');
  if (finding.workspace_id !== transition.workspaceId) throw new Error('FINDING_WORKSPACE_MISMATCH');

  const current = finding.lifecycle_state ?? 'open';
  const priorEvent = await db.queryOne<{ finding_id: string; workspace_id: string; to_state: FindingLifecycleState }>(
    'SELECT finding_id, workspace_id, to_state FROM finding_lifecycle_events WHERE idempotency_key = ?',
    [transition.idempotencyKey],
  );
  if (priorEvent) {
    if (priorEvent.finding_id !== transition.findingId || priorEvent.workspace_id !== transition.workspaceId || priorEvent.to_state !== transition.toState) {
      throw new Error('FINDING_LIFECYCLE_IDEMPOTENCY_CONFLICT');
    }
    return { changed: false, state: current };
  }
  if (current === transition.toState) return { changed: false, state: current };
  const decision = evaluateFindingTransition({
    currentState: current,
    targetState: transition.toState,
    findingWorkspaceId: finding.workspace_id,
    requestedWorkspaceId: transition.workspaceId,
    hasResolutionEvidence: transition.toState !== 'verified_resolved' || Boolean(transition.evidence?.scanId),
  });
  if (transition.toState === 'verified_resolved') await requireResolutionEvidence(db, transition.findingId, transition.evidence);

  const updated = await db.execute(
    'UPDATE findings SET lifecycle_state = ?, status = ? WHERE id = ? AND COALESCE(lifecycle_state, ?) = ?',
    [decision.state, decision.legacyStatus, transition.findingId, 'open', current],
  );
  if (updated.changes !== 1) {
    const latest = await getFinding(db, transition.findingId);
    if (latest?.lifecycle_state === transition.toState) return { changed: false, state: transition.toState };
    throw new Error('FINDING_LIFECYCLE_CONFLICT');
  }

  await db.execute(`
    INSERT INTO finding_lifecycle_events (id, finding_id, repository_id, workspace_id, actor_user_id, from_state, to_state, reason, evidence_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING
  `, [
    `fle_${crypto.randomBytes(12).toString('hex')}`,
    transition.findingId,
    finding.repository_id,
    transition.workspaceId,
    transition.actorUserId ?? null,
    current,
    transition.toState,
    transition.reason.trim(),
    transition.evidence ? JSON.stringify(transition.evidence) : null,
    transition.idempotencyKey,
    new Date().toISOString(),
  ]);
  return { changed: true, state: transition.toState };
}

export async function transitionFinding(db: DatabaseAdapter, transition: FindingLifecycleTransition): Promise<{ changed: boolean; state: FindingLifecycleState }> {
  return db.transaction((tx) => transitionFindingInTransaction(tx, transition));
}
