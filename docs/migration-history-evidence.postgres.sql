-- READ-ONLY TEMPLATE. Run only against an approved isolated PostgreSQL copy.
-- Do not substitute a production or staging connection.
SELECT id, name, applied_at
FROM public._apiproof_migrations
ORDER BY id, applied_at;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       current_user AS database_role;

SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       c.relkind AS object_kind,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind IN ('r', 'i', 'v', 'm', 'S', 'f')
ORDER BY n.nspname, c.relname;

SELECT table_schema, table_name, column_name, ordinal_position,
       data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
