import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { withPostgresTenantContext } from './db/postgres-tenant-context.js';
import { revokeWorkspaceMember } from './member-revocation.js';
import { requireWorkspaceMember, requireWorkspaceOwner, type WorkspaceRole, type WorkspaceWithRole } from './workspace-service.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface WorkspaceAuditEvent {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  actorEmail: string | null;
  createdAt: string;
}

export interface WorkspaceAuditPage {
  events: WorkspaceAuditEvent[];
  nextCursor: string | null;
}

export class OrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_WORKSPACE_NAME'
      | 'INVALID_WORKSPACE_SLUG'
      | 'INVALID_WORKSPACE_ID'
      | 'MEMBER_NOT_FOUND'
      | 'INVITATION_NOT_FOUND'
      | 'INVITATION_EXPIRED'
      | 'INVITATION_EMAIL_MISMATCH'
      | 'INVITATION_ALREADY_USED'
      | 'LAST_OWNER_REQUIRED'
      | 'ALREADY_A_MEMBER'
      | 'INVALID_AUDIT_CURSOR'
      | 'ORGANIZATION_SCHEMA_UNAVAILABLE',
  ) {
    super(message);
    this.name = 'OrganizationServiceError';
  }
}

const AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_METADATA_DEPTH = 3;
const MAX_AUDIT_METADATA_KEYS = 32;
const MAX_AUDIT_METADATA_ITEMS = 32;
const MAX_AUDIT_METADATA_STRING_LENGTH = 512;
const REDACTED_AUDIT_VALUE = '[REDACTED]';
const TRUNCATED_AUDIT_VALUE = '[TRUNCATED]';
const SENSITIVE_AUDIT_KEY = /(password|token|secret|cookie|authorization|api[_-]?key|private[_-]?key)/i;

function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth >= MAX_AUDIT_METADATA_DEPTH) return TRUNCATED_AUDIT_VALUE;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : TRUNCATED_AUDIT_VALUE;
  if (typeof value === 'string') return value.length > MAX_AUDIT_METADATA_STRING_LENGTH
    ? `${value.slice(0, MAX_AUDIT_METADATA_STRING_LENGTH)}${TRUNCATED_AUDIT_VALUE}`
    : value;
  if (Array.isArray(value)) return value.slice(0, MAX_AUDIT_METADATA_ITEMS).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, MAX_AUDIT_METADATA_KEYS).map(([key, item]) => [
      key,
      SENSITIVE_AUDIT_KEY.test(key) ? REDACTED_AUDIT_VALUE : sanitizeAuditMetadata(item, depth + 1),
    ]));
  }
  return TRUNCATED_AUDIT_VALUE;
}

function parseAuditMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = sanitizeAuditMetadata(JSON.parse(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function encodeAuditCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url');
}

function decodeAuditCursor(cursor: string): { createdAt: string; id: string } {
  if (cursor.length > 512) throw new OrganizationServiceError('Invalid audit cursor.', 'INVALID_AUDIT_CURSOR');
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt))
      || typeof parsed.id !== 'string' || parsed.id.length < 1 || parsed.id.length > 255) {
      throw new Error('invalid cursor');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new OrganizationServiceError('Invalid audit cursor.', 'INVALID_AUDIT_CURSOR');
  }
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

function throwOrganizationSchemaUnavailable(error: unknown): never {
  const message = String(error).toLowerCase();
  if (message.includes('no such table') || message.includes('does not exist')) {
    throw new OrganizationServiceError(
      'Organization administration is unavailable until the approved organization schema is installed.',
      'ORGANIZATION_SCHEMA_UNAVAILABLE',
    );
  }
  throw error;
}

function mapMember(row: { id: string; user_id: string; email: string; name: string; role: WorkspaceRole; created_at: string }): OrganizationMember {
  return { id: row.id, userId: row.user_id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at };
}

async function recordAudit(
  tx: DatabaseAdapter,
  workspaceId: string,
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx.execute(
    `INSERT INTO workspace_audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id('wae'), workspaceId, actorUserId, action, targetType, targetId, JSON.stringify(sanitizeAuditMetadata(metadata)), new Date().toISOString()],
  );
}

async function requireWorkspaceOwnerInTransaction(tx: DatabaseAdapter, userId: string, workspaceId: string): Promise<void> {
  const row = await tx.queryOne('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role = \'owner\'', [workspaceId, userId]);
  if (!row) throw new Error('Workspace not found or access denied.');
}

export async function updateWorkspaceSettings(userId: string, workspaceId: string, name: string, slug: string): Promise<WorkspaceWithRole> {
  await requireWorkspaceOwner(userId, workspaceId);
  const cleanName = name.trim();
  const cleanSlug = slug.trim().toLowerCase();
  if (cleanName.length < 1 || cleanName.length > 100) throw new OrganizationServiceError('Workspace name must be 1-100 characters.', 'INVALID_WORKSPACE_NAME');
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(cleanSlug)) throw new OrganizationServiceError('Workspace slug must be 3-64 lowercase letters, numbers, or hyphens.', 'INVALID_WORKSPACE_SLUG');

  const db = getDatabase();
  try {
    await withPostgresTenantContext(db, userId, workspaceId, async (tx) => {
      await requireWorkspaceOwnerInTransaction(tx, userId, workspaceId);
      await tx.execute('UPDATE workspaces SET name = ?, slug = ?, updated_at = ? WHERE id = ?', [cleanName, cleanSlug, new Date().toISOString(), workspaceId]);
      await recordAudit(tx, workspaceId, userId, 'workspace.updated', 'workspace', workspaceId, { name: cleanName, slug: cleanSlug });
    });
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) throw new OrganizationServiceError('That workspace slug is already in use.', 'INVALID_WORKSPACE_SLUG');
    throw error;
  }
  return requireWorkspaceMember(userId, workspaceId);
}

export async function listOrganizationMembers(userId: string, workspaceId: string): Promise<OrganizationMember[]> {
  await requireWorkspaceMember(userId, workspaceId);
  const rows = await withPostgresTenantContext(getDatabase(), userId, workspaceId, (tx) => tx.query<{ id: string; user_id: string; email: string; name: string; role: WorkspaceRole; created_at: string }>(
      `SELECT wm.id, wm.user_id, u.email, u.name, wm.role, wm.created_at
       FROM workspace_members wm JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, u.name ASC`,
      [workspaceId],
    ));
  return rows.map(mapMember);
}

export async function updateMemberRole(userId: string, workspaceId: string, targetUserId: string, role: WorkspaceRole): Promise<OrganizationMember[]> {
  await requireWorkspaceOwner(userId, workspaceId);
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await requireWorkspaceOwnerInTransaction(tx, userId, workspaceId);
    const member = await tx.queryOne<{ id: string; user_id: string; role: WorkspaceRole }>('SELECT id, user_id, role FROM workspace_members WHERE user_id = ? AND workspace_id = ?', [targetUserId, workspaceId]);
    if (!member) throw new OrganizationServiceError('Workspace member not found.', 'MEMBER_NOT_FOUND');
    const update = await tx.execute(
      `UPDATE workspace_members
       SET role = ?
       WHERE user_id = ? AND workspace_id = ?
         AND (role <> 'owner' OR ? = 'owner' OR
              (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ? AND role = 'owner') > 1)`,
      [role, targetUserId, workspaceId, role, workspaceId],
    );
    if (update.changes !== 1) throw new OrganizationServiceError('A workspace must retain at least one owner.', 'LAST_OWNER_REQUIRED');
    await recordAudit(tx, workspaceId, userId, 'member.role_updated', 'member', member.id, { userId: member.user_id, role });
  });
  return listOrganizationMembers(userId, workspaceId);
}

export async function removeOrganizationMember(userId: string, workspaceId: string, targetUserId: string): Promise<void> {
  await revokeWorkspaceMember(userId, {
    workspaceId,
    userId: targetUserId,
    idempotencyKey: `organization-member-remove:${workspaceId}:${targetUserId}`,
  });
}

export async function listWorkspaceInvitations(userId: string, workspaceId: string): Promise<WorkspaceInvitation[]> {
  await requireWorkspaceOwner(userId, workspaceId);
  let rows: Array<WorkspaceInvitation & { workspace_id: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string }>;
  try {
    rows = await getDatabase().query<WorkspaceInvitation & { workspace_id: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string }>(
      `SELECT id, workspace_id, email, role, expires_at, accepted_at, revoked_at, created_at
       FROM workspace_invitations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100`, [workspaceId],
    );
  } catch (error) {
    throwOrganizationSchemaUnavailable(error);
  }
  return rows.map((row) => ({ id: row.id, workspaceId: row.workspace_id, email: row.email, role: row.role, expiresAt: row.expires_at, acceptedAt: row.accepted_at, revokedAt: row.revoked_at, createdAt: row.created_at }));
}

export async function createWorkspaceInvitation(userId: string, workspaceId: string, email: string, role: WorkspaceRole): Promise<{ invitation: WorkspaceInvitation; token: string }> {
  await requireWorkspaceOwner(userId, workspaceId);
  const normalizedEmail = cleanEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) throw new Error('A valid invite email is required.');
  if (role !== 'member') throw new Error('Only member invitations are available.');
  const db = getDatabase();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const invitation = { id: id('wsi'), workspaceId, email: normalizedEmail, role, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(), acceptedAt: null, revokedAt: null, createdAt: now.toISOString() } satisfies WorkspaceInvitation;
  await db.transaction(async (tx) => {
    await requireWorkspaceOwnerInTransaction(tx, userId, workspaceId);
    const existingMember = await tx.queryOne('SELECT wm.id FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = ? AND lower(u.email) = ?', [workspaceId, normalizedEmail]);
    if (existingMember) throw new OrganizationServiceError('That person is already a workspace member.', 'ALREADY_A_MEMBER');
    await tx.execute('UPDATE workspace_invitations SET revoked_at = ? WHERE workspace_id = ? AND lower(email) = ? AND accepted_at IS NULL AND revoked_at IS NULL', [now.toISOString(), workspaceId, normalizedEmail]);
    await tx.execute(
      `INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, token_hash, expires_at, accepted_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      [invitation.id, workspaceId, userId, normalizedEmail, role, hashToken(token), invitation.expiresAt, invitation.createdAt],
    );
    await recordAudit(tx, workspaceId, userId, 'invitation.created', 'invitation', invitation.id, { email: normalizedEmail, role });
  });
  return { invitation, token };
}

export async function revokeWorkspaceInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void> {
  await requireWorkspaceOwner(userId, workspaceId);
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await requireWorkspaceOwnerInTransaction(tx, userId, workspaceId);
    const result = await tx.execute('UPDATE workspace_invitations SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL AND revoked_at IS NULL', [new Date().toISOString(), invitationId, workspaceId]);
    if (result.changes !== 1) throw new OrganizationServiceError('Invitation not found or already closed.', 'INVITATION_NOT_FOUND');
    await recordAudit(tx, workspaceId, userId, 'invitation.revoked', 'invitation', invitationId);
  });
}

export async function acceptWorkspaceInvitation(userId: string, token: string): Promise<WorkspaceWithRole> {
  const db = getDatabase();
  const user = await db.queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId]);
  if (!user) throw new OrganizationServiceError('Invitation recipient account was not found.', 'INVITATION_NOT_FOUND');
  const tokenHash = hashToken(token);
  let acceptedWorkspaceId: string;
  try {
    acceptedWorkspaceId = await db.transaction(async (tx) => {
      // Revocation locks the workspace membership set before invalidating
      // invitations. Resolve the workspace first, acquire that same lock
      // order, then re-read the invitation under lock to prevent re-entry.
      const invitationReference = await tx.queryOne<{ workspace_id: string }>(
        'SELECT workspace_id FROM workspace_invitations WHERE token_hash = ?',
        [tokenHash],
      );
      if (!invitationReference) throw new OrganizationServiceError('Invitation not found.', 'INVITATION_NOT_FOUND');
      await tx.query<{ id: string }>(
        `SELECT id FROM workspace_members WHERE workspace_id = ?${tx.engine === 'postgres' ? ' FOR UPDATE' : ''}`,
        [invitationReference.workspace_id],
      );
      const invitation = await tx.queryOne<{ id: string; workspace_id: string; email: string; role: WorkspaceRole; expires_at: string; accepted_at: string | null; revoked_at: string | null }>(
        `SELECT id, workspace_id, email, role, expires_at, accepted_at, revoked_at
         FROM workspace_invitations WHERE token_hash = ?${tx.engine === 'postgres' ? ' FOR UPDATE' : ''}`,
        [tokenHash],
      );
      if (!invitation) throw new OrganizationServiceError('Invitation not found.', 'INVITATION_NOT_FOUND');
      if (invitation.accepted_at || invitation.revoked_at) throw new OrganizationServiceError('Invitation has already been used or revoked.', 'INVITATION_ALREADY_USED');
      if (Date.parse(invitation.expires_at) <= Date.now()) throw new OrganizationServiceError('Invitation has expired.', 'INVITATION_EXPIRED');
      if (cleanEmail(user.email) !== cleanEmail(invitation.email)) throw new OrganizationServiceError('Sign in with the invited email address to accept this invitation.', 'INVITATION_EMAIL_MISMATCH');

      const existingMember = await tx.queryOne('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [invitation.workspace_id, userId]);
      if (existingMember) throw new OrganizationServiceError('That account is already a workspace member.', 'ALREADY_A_MEMBER');
      const update = await tx.execute('UPDATE workspace_invitations SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL', [new Date().toISOString(), invitation.id]);
      if (update.changes !== 1) throw new OrganizationServiceError('Invitation has already been used or revoked.', 'INVITATION_ALREADY_USED');
      await tx.execute('INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', [id('wsm'), invitation.workspace_id, userId, invitation.role, new Date().toISOString()]);
      await recordAudit(tx, invitation.workspace_id, userId, 'invitation.accepted', 'invitation', invitation.id);
      return invitation.workspace_id;
    });
  } catch (error) {
    if (String(error).toLowerCase().includes('unique') && String(error).toLowerCase().includes('workspace_members')) {
      throw new OrganizationServiceError('That account is already a workspace member.', 'ALREADY_A_MEMBER');
    }
    throw error;
  }
  return requireWorkspaceMember(userId, acceptedWorkspaceId);
}

export async function listWorkspaceAuditEvents(userId: string, workspaceId: string): Promise<WorkspaceAuditEvent[]> {
  return (await listWorkspaceAuditPage(userId, workspaceId)).events;
}

export async function listWorkspaceAuditPage(userId: string, workspaceId: string, cursor?: string, limit = AUDIT_PAGE_SIZE): Promise<WorkspaceAuditPage> {
  await requireWorkspaceMember(userId, workspaceId);
  const pageSize = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), AUDIT_PAGE_SIZE) : AUDIT_PAGE_SIZE;
  const decoded = cursor ? decodeAuditCursor(cursor) : undefined;
  const conditions = decoded
    ? `AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?))`
    : '';
  const parameters = decoded
    ? [workspaceId, decoded.createdAt, decoded.createdAt, decoded.id, pageSize + 1]
    : [workspaceId, pageSize + 1];
  let rows: Array<{ id: string; action: string; target_type: string; target_id: string | null; metadata_json: string; actor_email: string | null; created_at: string }>;
  try {
    rows = await getDatabase().query<{ id: string; action: string; target_type: string; target_id: string | null; metadata_json: string; actor_email: string | null; created_at: string }>(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata_json, u.email as actor_email, a.created_at
       FROM workspace_audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.workspace_id = ? ${conditions} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`, parameters,
    );
  } catch (error) {
    throwOrganizationSchemaUnavailable(error);
  }
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const events = pageRows.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, metadata: parseAuditMetadata(row.metadata_json), actorEmail: row.actor_email, createdAt: row.created_at }));
  const last = pageRows.at(-1);
  return { events, nextCursor: hasMore && last ? encodeAuditCursor(last.created_at, last.id) : null };
}
