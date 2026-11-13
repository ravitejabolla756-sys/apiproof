import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import {
  assertWorkspaceCapability,
  normalizeWorkspaceRole,
  type WorkspaceRole,
} from './workspace-policy.js';

const MAX_REASON_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export interface MemberRevocationRequest {
  readonly workspaceId: string;
  readonly userId: string;
  readonly reason?: string | undefined;
  readonly idempotencyKey: string;
}
/**
 * Server-derived state required to prepare a revocation. This is deliberately
 * not a database adapter: the future endpoint must load every field from the
 * current transaction and must not trust client-supplied roles or membership.
 */
export interface MemberRevocationContext {
  readonly actorUserId: string;
  readonly actorWorkspaceId: string;
  readonly actorRole: string;
  readonly subjectWorkspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string | null;
  readonly subjectRole: string | null;
  readonly ownerCount: number;
  readonly eventId: string;
}

export interface MemberRevocationPlan {
  readonly status: 'requested';
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string;
  readonly actorUserId: string;
  readonly reason: string | undefined;
  readonly idempotencyKey: string;
  readonly event: {
    readonly eventId: string;
    readonly eventType: 'workspace.member_revocation.v1';
    readonly workspaceId: string;
    readonly subjectUserId: string;
    readonly actorUserId: string;
    readonly membershipId: string;
    readonly reason: string | undefined;
    readonly idempotencyKey: string;
  };
  readonly invalidationScope: {
    readonly workspaceScoped: ReadonlyArray<string>;
    readonly preserved: ReadonlyArray<string>;
    readonly queuedJobs: 'recheck_membership_before_execution';
  };
}

export interface MemberRevocationResult {
  readonly requestId: string;
  readonly eventId: string;
  readonly status: 'completed';
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string;
  readonly actorUserId: string;
  readonly reason: string | undefined;
  readonly idempotencyKey: string;
  readonly invalidationScope: MemberRevocationPlan['invalidationScope'];
}

function requiredIdentifier(value: string, errorCode: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(errorCode);
  return value;
}

function normalizeReason(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined;
  const normalized = reason.trim();
  if (normalized.length > MAX_REASON_LENGTH) throw new Error('REVOCATION_REASON_TOO_LONG');
  return normalized || undefined;
}

function assertIdempotencyKey(value: string): string {
  const key = requiredIdentifier(value, 'REVOCATION_IDEMPOTENCY_KEY_REQUIRED');
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) throw new Error('REVOCATION_IDEMPOTENCY_KEY_TOO_LONG');
  return key;
}

/**
 * Validates the non-destructive ORG-10 boundary and returns the event/invalidation
 * plan that a later approved transaction may persist. It performs no writes,
 * session invalidation, membership deletion, invitation mutation, or job cancel.
 */
export function buildMemberRevocationPlan(
  request: MemberRevocationRequest,
  context: MemberRevocationContext,
): MemberRevocationPlan {
  const workspaceId = requiredIdentifier(request.workspaceId, 'WORKSPACE_ID_REQUIRED');
  const subjectUserId = requiredIdentifier(request.userId, 'SUBJECT_USER_ID_REQUIRED');
  const idempotencyKey = assertIdempotencyKey(request.idempotencyKey);
  const actorUserId = requiredIdentifier(context.actorUserId, 'ACTOR_USER_ID_REQUIRED');
  const eventId = requiredIdentifier(context.eventId, 'REVOCATION_EVENT_ID_REQUIRED');
  const reason = normalizeReason(request.reason);

  if (context.actorWorkspaceId !== workspaceId || context.subjectWorkspaceId !== workspaceId) {
    throw new Error('WORKSPACE_ACCESS_DENIED');
  }
  if (context.subjectUserId !== subjectUserId || !context.subjectMembershipId || !context.subjectRole) {
    throw new Error('WORKSPACE_MEMBER_NOT_FOUND');
  }
  if (actorUserId === subjectUserId) {
    throw new Error('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
  }
  if (!Number.isInteger(context.ownerCount) || context.ownerCount < 1) {
    throw new Error('OWNER_COUNT_INVALID');
  }

  const actorRole: WorkspaceRole = normalizeWorkspaceRole(context.actorRole);
  const subjectRole: WorkspaceRole = normalizeWorkspaceRole(context.subjectRole);
  assertWorkspaceCapability(actorRole, 'workspace:manage_members');
  if (subjectRole === 'owner' && context.ownerCount === 1) {
    throw new Error('FINAL_OWNER_PROTECTED');
  }

  return {
    status: 'requested',
    workspaceId,
    subjectUserId,
    subjectMembershipId: context.subjectMembershipId,
    actorUserId,
    reason,
    idempotencyKey,
    event: {
      eventId,
      eventType: 'workspace.member_revocation.v1',
      workspaceId,
      subjectUserId,
      actorUserId,
      membershipId: context.subjectMembershipId,
      reason,
      idempotencyKey,
    },
    invalidationScope: {
      workspaceScoped: [
        'membership',
        'workspace_sessions',
        'email_verification_state',
        'password_reset_state',
        'oauth_state',
        'pending_invitations_for_removed_email',
      ],
      preserved: ['personal_sessions', 'other_workspace_memberships'],
      queuedJobs: 'recheck_membership_before_execution',
    },
  };
}

interface RevocationRow {
  id: string;
  event_id: string | null;
  workspace_id: string;
  subject_user_id: string;
  actor_user_id: string;
  membership_id: string;
  reason: string | null;
  idempotency_key: string;
  status: string;
}

function resultFromRow(row: RevocationRow): MemberRevocationResult {
  if (row.status !== 'completed' || !row.event_id) {
    throw new Error('REVOCATION_REQUEST_NOT_TERMINAL');
  }
  return {
    requestId: row.id,
    eventId: row.event_id,
    status: 'completed',
    workspaceId: row.workspace_id,
    subjectUserId: row.subject_user_id,
    subjectMembershipId: row.membership_id,
    actorUserId: row.actor_user_id,
    reason: row.reason ?? undefined,
    idempotencyKey: row.idempotency_key,
    invalidationScope: {
      workspaceScoped: [
        'membership',
        'workspace_sessions',
        'email_verification_state',
        'password_reset_state',
        'oauth_state',
        'pending_invitations_for_removed_email',
      ],
      preserved: ['personal_sessions', 'other_workspace_memberships'],
      queuedJobs: 'recheck_membership_before_execution',
    },
  };
}

function conflictIfDifferent(existing: RevocationRow, plan: MemberRevocationPlan): void {
  if (existing.subject_user_id !== plan.subjectUserId
    || existing.actor_user_id !== plan.actorUserId
    || existing.reason !== (plan.reason ?? null)) {
    throw new Error('REVOCATION_IDEMPOTENCY_CONFLICT');
  }
}

async function hasTable(tx: DatabaseAdapter, tableName: string): Promise<boolean> {
  if (tx.engine === 'postgres') {
    const row = await tx.queryOne<{ exists: boolean | string }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ?
       ) AS exists`, [tableName],
    );
    return row?.exists === true || row?.exists === 'true';
  }
  return Boolean(await tx.queryOne<{ name: string }>(
    'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = ?', [tableName],
  ));
}

async function findExisting(tx: DatabaseAdapter, workspaceId: string, idempotencyKey: string): Promise<RevocationRow | undefined> {
  return tx.queryOne<RevocationRow>(`
    SELECT id, audit_event_id AS event_id, workspace_id, subject_user_id, actor_user_id,
      membership_id, reason, idempotency_key, status
    FROM workspace_member_revocation_requests
    WHERE workspace_id = ? AND idempotency_key = ?
  `, [workspaceId, idempotencyKey]);
}

/**
 * Atomically revokes one member's access to one workspace. The transaction
 * locks the current membership set on PostgreSQL and is serialized by the
 * SQLite adapter. No user session or account row is deleted: all workspace
 * authorization continues to resolve from the current membership row.
 */
export async function revokeWorkspaceMember(
  actorUserId: string,
  request: MemberRevocationRequest,
): Promise<MemberRevocationResult> {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const revocationTablesAvailable = await hasTable(tx, 'workspace_member_revocation_requests')
      && await hasTable(tx, 'workspace_security_audit_events');
    if (!revocationTablesAvailable) throw new Error('REVOCATION_SCHEMA_UNAVAILABLE');

    const actor = await tx.queryOne<{ role: string }>(`
      SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
    `, [request.workspaceId, actorUserId]);
    if (!actor) throw new Error('WORKSPACE_ACCESS_DENIED');

    const existingBeforeLock = await findExisting(tx, request.workspaceId, request.idempotencyKey);
    if (existingBeforeLock) {
      if (existingBeforeLock.subject_user_id !== request.userId || existingBeforeLock.actor_user_id !== actorUserId) {
        throw new Error('REVOCATION_IDEMPOTENCY_CONFLICT');
      }
      const existingContext = await tx.queryOne<{ id: string; role: string }>(`
        SELECT id, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
      `, [request.workspaceId, actorUserId]);
      if (!existingContext) throw new Error('WORKSPACE_ACCESS_DENIED');
      const existingPlan = buildMemberRevocationPlan(request, {
        actorUserId,
        actorWorkspaceId: request.workspaceId,
        actorRole: existingContext.role,
        subjectWorkspaceId: existingBeforeLock.workspace_id,
        subjectUserId: existingBeforeLock.subject_user_id,
        subjectMembershipId: existingBeforeLock.membership_id,
        subjectRole: 'member',
        ownerCount: 2,
        eventId: existingBeforeLock.event_id ?? 'evt_existing',
      });
      conflictIfDifferent(existingBeforeLock, existingPlan);
      return resultFromRow(existingBeforeLock);
    }

    const membershipRows = await tx.query<{ id: string; user_id: string; role: string }>(
      db.engine === 'postgres'
        ? 'SELECT id, user_id, role FROM workspace_members WHERE workspace_id = ? FOR UPDATE'
        : 'SELECT id, user_id, role FROM workspace_members WHERE workspace_id = ?',
      [request.workspaceId],
    );
    const subject = membershipRows.find((row) => row.user_id === request.userId);
    const actorRow = membershipRows.find((row) => row.user_id === actorUserId);
    if (!actorRow) throw new Error('WORKSPACE_ACCESS_DENIED');

    const ownerCount = membershipRows.filter((row) => row.role === 'owner').length;
    const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
    const plan = buildMemberRevocationPlan(request, {
      actorUserId,
      actorWorkspaceId: request.workspaceId,
      actorRole: actorRow.role,
      subjectWorkspaceId: request.workspaceId,
      subjectUserId: request.userId,
      subjectMembershipId: subject?.id ?? null,
      subjectRole: subject?.role ?? null,
      ownerCount,
      eventId,
    });

    const requestId = `mrr_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();
    const inserted = await tx.execute(`
      INSERT INTO workspace_member_revocation_requests
        (id, workspace_id, subject_user_id, actor_user_id, membership_id, reason,
         idempotency_key, status, policy_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', 'org-10.v1', ?, ?)
      ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    `, [requestId, plan.workspaceId, plan.subjectUserId, plan.actorUserId, plan.subjectMembershipId,
      plan.reason ?? null, plan.idempotencyKey, now, now]);
    if (inserted.changes !== 1) {
      const raced = await findExisting(tx, request.workspaceId, request.idempotencyKey);
      if (!raced) throw new Error('REVOCATION_REQUEST_RACE_UNRESOLVED');
      conflictIfDifferent(raced, plan);
      return resultFromRow(raced);
    }

    const removed = await tx.execute(`
      DELETE FROM workspace_members
      WHERE id = ? AND workspace_id = ? AND user_id = ?
    `, [plan.subjectMembershipId, plan.workspaceId, plan.subjectUserId]);
    if (removed.changes !== 1) throw new Error('WORKSPACE_MEMBER_NOT_FOUND');

    const subjectUser = await tx.queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', [plan.subjectUserId]);
    if (!subjectUser) throw new Error('WORKSPACE_MEMBER_NOT_FOUND');
    if (await hasTable(tx, 'workspace_invitations')) {
      const invitations = await tx.execute(
        `UPDATE workspace_invitations
         SET revoked_at = ?
         WHERE workspace_id = ? AND lower(email) = lower(?)
           AND accepted_at IS NULL AND revoked_at IS NULL`,
        [now, plan.workspaceId, subjectUser.email.trim()],
      );
      if (invitations.changes > 0 && await hasTable(tx, 'workspace_audit_events')) {
        await tx.execute(
          `INSERT INTO workspace_audit_events
            (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
           VALUES (?, ?, ?, 'member.pending_invitations_invalidated', 'member', ?, ?, ?)`,
          [`wae_${crypto.randomBytes(12).toString('hex')}`, plan.workspaceId, plan.actorUserId, plan.subjectUserId,
            JSON.stringify({ invalidatedCount: invitations.changes }), now],
        );
      }
    }

    const occurredAt = new Date().toISOString();
    await tx.execute(`
      INSERT INTO workspace_security_audit_events
        (id, workspace_id, event_type, subject_user_id, actor_user_id, membership_id,
         reason, idempotency_key, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [plan.event.eventId, plan.workspaceId, plan.event.eventType, plan.subjectUserId, plan.actorUserId,
      plan.subjectMembershipId, plan.reason ?? null, plan.idempotencyKey, occurredAt, JSON.stringify({
        eventId: plan.event.eventId,
        eventType: plan.event.eventType,
        workspaceId: plan.workspaceId,
        subjectUserId: plan.subjectUserId,
        actorUserId: plan.actorUserId,
        membershipId: plan.subjectMembershipId,
        reason: plan.reason ?? null,
        idempotencyKey: plan.idempotencyKey,
        occurredAt,
      })]);
    await tx.execute(`
      UPDATE workspace_member_revocation_requests
      SET status = 'completed', audit_event_id = ?, outcome_code = 'MEMBERSHIP_REVOKED',
        updated_at = ?, completed_at = ?
      WHERE id = ? AND status = 'processing'
    `, [plan.event.eventId, occurredAt, occurredAt, requestId]);

    return {
      requestId,
      eventId: plan.event.eventId,
      status: 'completed',
      workspaceId: plan.workspaceId,
      subjectUserId: plan.subjectUserId,
      subjectMembershipId: plan.subjectMembershipId,
      actorUserId: plan.actorUserId,
      reason: plan.reason,
      idempotencyKey: plan.idempotencyKey,
      invalidationScope: plan.invalidationScope,
    };
  });
}

