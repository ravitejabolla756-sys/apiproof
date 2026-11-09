-- MY OWL V1 read-only PostgreSQL verification pack.
-- Run only by an approved operator in an isolated staging database.
-- This file intentionally contains no credentials and no mutating statements.

BEGIN READ ONLY;

SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('server_version') AS server_version;

WITH required(table_name) AS (
  VALUES
    ('workspace_members'), ('repositories'), ('github_scan_requests'),
    ('findings'), ('migrations'), ('pull_requests'), ('scans'),
    ('workspace_invitations'), ('workspace_audit_events'),
    ('workspace_member_revocation_requests'), ('workspace_security_audit_events'),
    ('email_deliveries'), ('slack_scan_failure_deliveries')
)
SELECT required.table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       to_regclass('public.' || required.table_name) IS NOT NULL AS table_exists
FROM required
LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || required.table_name)
ORDER BY required.table_name;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workspace_members', 'repositories', 'github_scan_requests', 'findings',
    'migrations', 'pull_requests', 'scans', 'workspace_invitations',
    'workspace_audit_events', 'workspace_member_revocation_requests',
    'workspace_security_audit_events', 'email_deliveries',
    'slack_scan_failure_deliveries'
  )
ORDER BY tablename, policyname;

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'workspace_members', 'repositories', 'github_scan_requests', 'findings',
    'migrations', 'pull_requests', 'scans', 'workspace_invitations',
    'workspace_audit_events', 'workspace_member_revocation_requests',
    'workspace_security_audit_events', 'email_deliveries',
    'slack_scan_failure_deliveries'
  )
ORDER BY table_name, grantee, privilege_type;

SELECT id, name, applied_at
FROM _apiproof_migrations
WHERE id IN ('024', '025', '026', '027')
ORDER BY id;

SELECT id, COUNT(*) AS rows_for_id, COUNT(DISTINCT name) AS distinct_names
FROM _apiproof_migrations
GROUP BY id
HAVING COUNT(*) > 1 OR COUNT(DISTINCT name) > 1
ORDER BY id;

ROLLBACK;
