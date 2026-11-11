-- READ-ONLY SEC-02 evidence template.
-- Run separately as the approved application and migrator roles against a
-- disposable PostgreSQL copy. Do not paste passwords or connection strings.
-- This template intentionally performs metadata queries only.

SELECT current_database() AS database_name,
       current_user AS database_role,
       session_user AS session_role,
       current_setting('server_version') AS server_version;

SELECT r.rolname,
       r.rolsuper,
       r.rolcreaterole,
       r.rolcreatedb,
       r.rolcanlogin,
       r.rolinherit,
       r.rolbypassrls
FROM pg_roles AS r
WHERE r.rolname = current_user;

SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS public_schema_usage,
       has_schema_privilege(current_user, 'public', 'CREATE') AS public_schema_create,
       has_table_privilege(current_user, '_apiproof_migrations', 'SELECT') AS can_read_migration_ledger,
       has_table_privilege(current_user, '_apiproof_migrations', 'INSERT') AS can_insert_migration_ledger,
       has_table_privilege(current_user, '_apiproof_migrations', 'UPDATE') AS can_update_migration_ledger,
       has_table_privilege(current_user, '_apiproof_migrations', 'DELETE') AS can_delete_migration_ledger;

SELECT table_schema,
       table_name,
       privilege_type,
       is_grantable
FROM information_schema.role_table_grants
WHERE grantee = current_user
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, privilege_type;

SELECT member.rolname AS member_role,
       parent.rolname AS granted_role,
       membership.admin_option
FROM pg_auth_members AS membership
JOIN pg_roles AS member ON member.oid = membership.member
JOIN pg_roles AS parent ON parent.oid = membership.roleid
WHERE member.rolname = current_user
ORDER BY parent.rolname;

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Owner-run comparison only: execute this query as the approved migrator role
-- and compare the sanitized result with the application-role result.
SELECT current_user AS migrator_role,
       has_schema_privilege(current_user, 'public', 'CREATE') AS migrator_can_create_schema,
       has_table_privilege(current_user, '_apiproof_migrations', 'INSERT') AS migrator_can_insert_ledger,
       has_table_privilege(current_user, '_apiproof_migrations', 'UPDATE') AS migrator_can_update_ledger;
