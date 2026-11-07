import type { DatabaseAdapter, Migration } from './types.js';

export const EMAIL_DELIVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_deliveries (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  template_key TEXT NOT NULL,
  template_version TEXT NOT NULL,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,
  next_attempt_at TEXT,
  claimed_by TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_delivery_claim
  ON email_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_recipient
  ON email_deliveries(recipient_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_workspace
  ON email_deliveries(workspace_id, created_at);
`;

export const SQLITE_EMAIL_DELIVERY_SCHEMA = EMAIL_DELIVERY_SCHEMA;

export const emailDeliveryMigrations: Migration[] = [{
  id: '026',
  name: 'email_delivery_ledger',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(EMAIL_DELIVERY_SCHEMA);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE email_deliveries FROM PUBLIC, anon, authenticated');
    }
  },
}];
