import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_NOTIFICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, category, channel)
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON user_notification_preferences(user_id, updated_at);
`;

export const notificationMigrations: Migration[] = [{
  id: '025',
  name: 'user_notification_preferences',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(SQLITE_NOTIFICATION_SCHEMA);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE user_notification_preferences FROM PUBLIC, anon, authenticated');
    }
  },
}];
