-- READ-ONLY TEMPLATE. Run only against an approved isolated SQLite copy.
-- Do not substitute a production or staging database path.
SELECT id, name, applied_at
FROM _apiproof_migrations
ORDER BY id, applied_at;

SELECT type, name, tbl_name, sql
FROM sqlite_schema
WHERE type IN ('table', 'index', 'trigger', 'view')
  AND name NOT LIKE 'sqlite_%'
ORDER BY type, name;

PRAGMA user_version;
