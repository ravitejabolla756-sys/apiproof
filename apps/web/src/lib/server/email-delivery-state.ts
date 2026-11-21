import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';

export const EMAIL_DELIVERY_MAX_ATTEMPTS = 5;
export const EMAIL_DELIVERY_LEASE_MS = 2 * 60_000;
const EMAIL_DELIVERY_RETRY_BASE_MS = 1_000;
const EMAIL_DELIVERY_RETRY_MAX_MS = 60 * 60 * 1_000;

export type EmailDeliveryStatus = 'pending' | 'processing' | 'delivered' | 'failed';

export interface TrackedEmailRequest {
  eventKey: string;
  templateKey: string;
  templateVersion: string;
  recipientUserId: string;
  workspaceId?: string | null;
}

export interface EmailDeliveryRecord {
  id: string;
  event_key: string;
  template_key: string;
  template_version: string;
  recipient_user_id: string | null;
  workspace_id: string | null;
  status: EmailDeliveryStatus;
  attempt_count: number;
  error_category: string | null;
  next_attempt_at: string | null;
  claimed_by: string | null;
  lease_expires_at: string | null;
  delivered_at: string | null;
}

export type TrackedEmailSender = (delivery: EmailDeliveryRecord) => Promise<void>;

export class EmailDeliveryUnavailableError extends Error {
  readonly code = 'EMAIL_DELIVERY_UNAVAILABLE';

  constructor() {
    super('Tracked email delivery is unavailable until the approved email ledger schema is installed.');
    this.name = 'EmailDeliveryUnavailableError';
  }
}

export function emailDeliveryRetryDelayMs(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) return EMAIL_DELIVERY_RETRY_BASE_MS;
  return Math.min(EMAIL_DELIVERY_RETRY_MAX_MS, EMAIL_DELIVERY_RETRY_BASE_MS * (2 ** Math.min(attempt - 1, 16)));
}

export function emailDeliveryErrorCategory(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : 'EMAIL_PROVIDER_FAILED';
}

async function requireEmailLedger(database: DatabaseAdapter): Promise<void> {
  try {
    await database.query('SELECT 1 FROM email_deliveries LIMIT 1');
  } catch {
    throw new EmailDeliveryUnavailableError();
  }
}

async function findOrCreateDelivery(input: TrackedEmailRequest, database: DatabaseAdapter): Promise<EmailDeliveryRecord> {
  await requireEmailLedger(database);
  const now = new Date().toISOString();
  const id = `eml_${crypto.randomBytes(16).toString('hex')}`;
  await database.execute(`
    INSERT INTO email_deliveries
      (id, event_key, template_key, template_version, recipient_user_id, workspace_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(event_key) DO NOTHING
  `, [id, input.eventKey, input.templateKey, input.templateVersion, input.recipientUserId, input.workspaceId ?? null, now, now]);
  const row = await database.queryOne<EmailDeliveryRecord>('SELECT * FROM email_deliveries WHERE event_key = ?', [input.eventKey]);
  if (!row) throw new Error('EMAIL_DELIVERY_RECORD_UNAVAILABLE');
  return row;
}

/**
 * Persist an idempotent pending delivery without claiming it or contacting a
 * provider. Trusted schedulers use this handoff before a separate delivery
 * worker performs the provider-specific send.
 */
export async function queueTrackedEmailDelivery(
  input: TrackedEmailRequest,
  database: DatabaseAdapter = getDatabase(),
): Promise<EmailDeliveryRecord> {
  return findOrCreateDelivery(input, database);
}

async function claimDelivery(id: string, database: DatabaseAdapter): Promise<EmailDeliveryRecord | undefined> {
  const now = new Date().toISOString();
  const workerId = `email_${crypto.randomBytes(8).toString('hex')}`;
  const leaseExpiresAt = new Date(Date.now() + EMAIL_DELIVERY_LEASE_MS).toISOString();
  const claimed = await database.execute(`
    UPDATE email_deliveries
    SET status = 'processing', attempt_count = attempt_count + 1, updated_at = ?, error_category = NULL,
        claimed_by = ?, lease_expires_at = ?
    WHERE id = ? AND status = 'pending' AND attempt_count < ?
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
  `, [now, workerId, leaseExpiresAt, id, EMAIL_DELIVERY_MAX_ATTEMPTS, now]);
  if (claimed.changes !== 1) return undefined;
  return database.queryOne<EmailDeliveryRecord>('SELECT * FROM email_deliveries WHERE id = ?', [id]);
}

async function deliverClaimedEmail(
  claimed: EmailDeliveryRecord,
  send: TrackedEmailSender,
  database: DatabaseAdapter,
): Promise<EmailDeliveryRecord> {
  try {
    await send(claimed);
    const now = new Date().toISOString();
    await database.execute(`
      UPDATE email_deliveries
      SET status = 'delivered', delivered_at = ?, updated_at = ?, next_attempt_at = NULL, claimed_by = NULL, lease_expires_at = NULL
      WHERE id = ? AND status = 'processing' AND claimed_by = ? AND lease_expires_at > ?
    `, [now, now, claimed.id, claimed.claimed_by, now]);
    const completed = await database.queryOne<EmailDeliveryRecord>('SELECT * FROM email_deliveries WHERE id = ?', [claimed.id]);
    if (!completed || completed.status !== 'delivered') throw new Error('EMAIL_DELIVERY_STATE_UNAVAILABLE');
    return completed;
  } catch (error) {
    const now = new Date().toISOString();
    const nextAttemptAt = claimed.attempt_count < EMAIL_DELIVERY_MAX_ATTEMPTS
      ? new Date(Date.now() + emailDeliveryRetryDelayMs(claimed.attempt_count)).toISOString()
      : null;
    await database.execute(`
      UPDATE email_deliveries
      SET status = 'failed', error_category = ?, next_attempt_at = ?, updated_at = ?, claimed_by = NULL, lease_expires_at = NULL
      WHERE id = ? AND status = 'processing' AND claimed_by = ?
    `, [emailDeliveryErrorCategory(error), nextAttemptAt, now, claimed.id, claimed.claimed_by]);
    throw error;
  }
}

/**
 * Claims and processes one pending delivery for an approved worker. The
 * sender is injected so this module never selects a provider or performs a
 * network call. Lease recovery and the existing five-attempt cap remain in
 * force before a new claim is made.
 */
export async function processNextTrackedEmailDelivery(
  send: TrackedEmailSender,
  database: DatabaseAdapter = getDatabase(),
): Promise<EmailDeliveryRecord | undefined> {
  await requireEmailLedger(database);
  const now = new Date().toISOString();
  await requeueRetryableEmailDeliveries(now, database);
  const candidate = await database.queryOne<EmailDeliveryRecord>(`
    SELECT * FROM email_deliveries
    WHERE status = 'pending' AND attempt_count < ?
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY created_at, id
    LIMIT 1
  `, [EMAIL_DELIVERY_MAX_ATTEMPTS, now]);
  if (!candidate) return undefined;
  const claimed = await claimDelivery(candidate.id, database);
  return claimed ? deliverClaimedEmail(claimed, send, database) : undefined;
}

export async function getEmailDelivery(eventKey: string, database: DatabaseAdapter = getDatabase()): Promise<EmailDeliveryRecord | undefined> {
  await requireEmailLedger(database);
  return database.queryOne<EmailDeliveryRecord>('SELECT * FROM email_deliveries WHERE event_key = ?', [eventKey]);
}

export async function requeueRetryableEmailDeliveries(now = new Date().toISOString(), database: DatabaseAdapter = getDatabase()): Promise<number> {
  await requireEmailLedger(database);
  return database.transaction(async (tx) => {
    const stale = await tx.query<{ id: string; attempt_count: number }>(`
      SELECT id, attempt_count FROM email_deliveries
      WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
    `, [now]);
    for (const delivery of stale) {
      const retryAt = delivery.attempt_count < EMAIL_DELIVERY_MAX_ATTEMPTS
        ? new Date(Date.parse(now) + emailDeliveryRetryDelayMs(delivery.attempt_count)).toISOString()
        : null;
      await tx.execute(`
        UPDATE email_deliveries
        SET status = 'failed', error_category = 'EMAIL_DELIVERY_UNCERTAIN', next_attempt_at = ?,
            claimed_by = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'processing' AND lease_expires_at <= ?
      `, [retryAt, now, delivery.id, now]);
    }
    const result = await tx.execute(`
      UPDATE email_deliveries
      SET status = 'pending', updated_at = ?, next_attempt_at = NULL
      WHERE status = 'failed' AND attempt_count < ? AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?
    `, [now, EMAIL_DELIVERY_MAX_ATTEMPTS, now]);
    return result.changes;
  });
}

export async function sendTrackedEmail(
  input: TrackedEmailRequest,
  send: () => Promise<void>,
  database: DatabaseAdapter = getDatabase(),
): Promise<EmailDeliveryRecord> {
  const delivery = await findOrCreateDelivery(input, database);
  if (delivery.status === 'delivered') return delivery;
  const claimed = await claimDelivery(delivery.id, database);
  if (!claimed) throw new Error('EMAIL_DELIVERY_NOT_CLAIMED');
  return deliverClaimedEmail(claimed, async () => send(), database);
}
