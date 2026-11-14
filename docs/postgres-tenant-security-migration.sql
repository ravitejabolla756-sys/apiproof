-- MY OWL V1 PostgreSQL tenant-security migration candidate.
--
-- This file is intentionally NOT registered in the application migrator. IDs
-- 024-027 have unresolved historical collisions, and this artifact must not be
-- applied to an existing database until ledger/schema evidence and a trusted
-- application-role identity bridge are approved.
--
-- Preconditions for an approved disposable database:
--   1. The schema has been migrated through the reviewed baseline.
--   2. The application role cannot SET ROLE to the migration role.
--   3. The application role is not a table owner and has no BYPASSRLS.
--   4. The application sets app.user_id/app.workspace_id only after server-side
--      authentication and membership authorization, in the same transaction.
--   5. The owner has reviewed the role names and grants in this file.

BEGIN;

-- Remove ambient default access before enabling table policies. The concrete
-- application role grants must be supplied by the database owner; PUBLIC must
-- not retain access to tenant-owned tables.
REVOKE ALL ON TABLE
  workspaces,
  workspace_members,
  github_installations,
  github_scan_requests,
  repositories,
  scans,
  findings,
  migrations,
  pull_requests,
  workspace_subscriptions,
  workspace_usage
FROM PUBLIC;

-- RLS is enabled only where the current schema has an explicit tenant key or
-- an unambiguous workspace relationship. OAuth/session/token tables are not
-- covered by these workspace policies and require separate account policies.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspaces', 'workspace_members', 'github_installations',
    'github_scan_requests', 'repositories', 'scans', 'findings', 'migrations',
    'pull_requests', 'workspace_subscriptions',
    'workspace_usage'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

-- A policy on workspace_members cannot query workspace_members directly: that
-- would recurse through RLS. This owner-run helper is deliberately isolated,
-- has a fixed search_path, and must be granted only to the reviewed app role.
CREATE SCHEMA IF NOT EXISTS apiproof_security;
REVOKE ALL ON SCHEMA apiproof_security FROM PUBLIC;
CREATE OR REPLACE FUNCTION apiproof_security.has_workspace_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = current_setting('app.workspace_id', true)
      AND wm.user_id = current_setting('app.user_id', true)
  )
$$;
REVOKE ALL ON FUNCTION apiproof_security.has_workspace_membership() FROM PUBLIC;

-- Membership is the source of workspace authorization. These policies use the
-- transaction-local context established by the server-side adapter helper.
DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY apiproof_workspaces_member ON public.workspaces
      FOR ALL
      USING (id = current_setting('app.workspace_id', true)
             AND apiproof_security.has_workspace_membership())
      WITH CHECK (id = current_setting('app.workspace_id', true))
    $policy$;
  END IF;

  IF to_regclass('public.workspace_members') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY apiproof_workspace_members_member ON public.workspace_members
      FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)
             AND apiproof_security.has_workspace_membership())
      WITH CHECK (workspace_id = current_setting('app.workspace_id', true))
    $policy$;
  END IF;
END $$;

-- Direct workspace-keyed tables.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'github_installations', 'github_scan_requests', 'workspace_subscriptions',
    'workspace_usage'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format($policy$
        CREATE POLICY apiproof_%1$I_member ON public.%1$I
        FOR ALL
        USING (workspace_id = current_setting('app.workspace_id', true)
               AND apiproof_security.has_workspace_membership())
        WITH CHECK (workspace_id = current_setting('app.workspace_id', true))
      $policy$, table_name);
    END IF;
  END LOOP;
END $$;

-- Indirect repository-owned tables. The repository workspace must agree with
-- the active context for every read and write.
DO $$
DECLARE
  table_name text;
BEGIN
  IF to_regclass('public.repositories') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY apiproof_repositories_member ON public.repositories
      FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)
             AND apiproof_security.has_workspace_membership())
      WITH CHECK (workspace_id = current_setting('app.workspace_id', true))
    $policy$;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['scans', 'findings', 'migrations', 'pull_requests'] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format($policy$
        CREATE POLICY apiproof_%1$I_member ON public.%1$I
        FOR ALL
        USING (EXISTS (
          SELECT 1
          FROM public.repositories r
          JOIN public.workspace_members wm ON wm.workspace_id = r.workspace_id
          WHERE r.id = %1$I.repository_id
            AND r.workspace_id = current_setting('app.workspace_id', true)
            AND wm.user_id = current_setting('app.user_id', true)
        ))
        WITH CHECK (EXISTS (
          SELECT 1
          FROM public.repositories r
          WHERE r.id = %1$I.repository_id
            AND r.workspace_id = current_setting('app.workspace_id', true)
        ))
      $policy$, table_name);
    END IF;
  END LOOP;
END $$;

-- Activity and billing webhook rows are workspace-scoped only after their
-- schema is confirmed. Do not create policies for global auth or migration
-- ledger tables in this candidate.
COMMIT;
