# MY OWL V1 — Database RLS and Least-Privilege Access Matrix

Status: local source inventory and staging test contract only. No database connection, production SQL, grant change, RLS policy change, or customer data access was performed.

Date: 2026-11-06
Worktree: `C:\YC-my-owl-v1-member1`
Branch: `codex/v1-backend-security`

## Scope and evidence boundary

This inventory covers every `CREATE TABLE IF NOT EXISTS` declaration under `apps/web/src/lib/server/db/` in the isolated worktree. The source contains 46 distinct tables, reconciled against the matrix by `tests/database-access-matrix.test.ts`. The PostgreSQL adapter, migration runner, and migration modules were read directly because the codebase-memory index reported metadata changes after the security edits.

The application currently uses a single `DATABASE_URL`/`APIPROOF_DATABASE_URL` connection pool for both normal queries and migrations. The source does not define database roles, `GRANT`, `CREATE POLICY`, `CREATE ROLE`, `ALTER DEFAULT PRIVILEGES`, `SET ROLE`, or a tenant session variable. Therefore local SQLite/application authorization tests cannot prove PostgreSQL role isolation or RLS behavior.

## Table-by-table decision

`Backend predicate` means the existing application must continue to scope access through authenticated user/workspace/repository joins even after database controls are added. `RLS target` means an approved PostgreSQL design should protect the table when accessed by a non-owner runtime role. `Migration/admin only` means the table should not be exposed to client-facing database roles.

| Table | Tenant/user key or relationship | Sensitivity | Decision | Current source evidence |
|---|---|---:|---|---|
| `_apiproof_migrations` | none | high | Migration/admin only | Created by the migration runner; no RLS/grant contract |
| `activity_events` | `user_id`, optional `repository_id` → workspace | high | RLS target; backend predicate | User/repository rows are persisted; no RLS in base schema |
| `billing_webhook_events` | provider event, no tenant key | high | Migration/admin only; backend webhook path | Idempotency table; no RLS/grant contract |
| `email_verification_tokens` | `user_id` → user | critical | RLS target; migration/admin only for direct clients | Migration 024 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; token hashes and lifecycle metadata; no policy is defined |
| `finding_lifecycle_events` | `workspace_id`, `repository_id`, `finding_id` | high | RLS target; backend predicate | Migration 025 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; immutable lifecycle evidence; no policy is defined |
| `finding_resolution_verifications` | `workspace_id`, `repository_id`, `finding_id`, `migration_id`, `pull_request_id`, `scan_id` | high | RLS target; backend predicate | Migration 026 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; exact-commit resolution evidence; no policy is defined |
| `findings` | `repository_id` → workspace | high | RLS target; backend predicate | Repository foreign key and route predicates; no RLS |
| `github_installation_states` | `user_id`, `workspace_id` | high | RLS target; migration/admin only for direct clients | OAuth state; no RLS in migration 005 |
| `github_installations` | `workspace_id` | high | RLS target; backend predicate | Workspace foreign key; no RLS |
| `github_login_oauth_states` | state only | critical | Migration/admin only; RLS required | Migration 023 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; no policy is defined |
| `github_oauth_accounts` | `user_id` | critical | RLS target; migration/admin only for direct clients | Migration 023 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; no policy is defined |
| `github_scan_requests` | `workspace_id`, `repository_id` | high | RLS target; worker/backend predicate | Workspace/repository foreign keys; no RLS |
| `github_webhook_deliveries` | delivery only | high | Migration/admin only | Webhook ingestion table; no tenant key or RLS |
| `google_oauth_accounts` | `user_id` | critical | RLS target; migration/admin only for direct clients | Migration 022 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; no policy is defined |
| `google_oauth_states` | state only | critical | Migration/admin only; RLS required | Migration 022 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; no policy is defined |
| `migration_verification_jobs` | `workspace_id`, `repository_id` | high | RLS target; worker/backend predicate | Workspace/repository fields; no RLS |
| `migration_verification_workers` | worker identity | high | Migration/admin only | Lease/worker coordination; no tenant policy |
| `migrations` | `repository_id`, `finding_id` → workspace | critical | RLS target; backend predicate | Patch/proof content is persisted; no RLS |
| `password_reset_tokens` | `user_id` | critical | RLS target; migration/admin only for direct clients | Token hashes only, but credential recovery data; no RLS |
| `provider_change_sources` | global provider source | medium | Migration/admin only | Scheduler source configuration; no tenant key |
| `provider_changelog_entries` | global provider source | medium | Migration/admin only | Provider intelligence corpus; no tenant key |
| `provider_rescan_jobs` | `workspace_id` | high | RLS target; worker/backend predicate | Workspace index and job fields; no RLS |
| `provider_rule_candidates` | `workspace_id` where present | high | RLS target; backend predicate | Review queue can contain workspace-scoped candidates; no RLS |
| `provider_rule_reviews` | candidate relationship | high | RLS target through candidate ownership | Review decisions; no RLS |
| `pull_requests` | `repository_id` → workspace | high | RLS target; backend predicate | Draft PR metadata; no RLS |
| `rate_limits` | key only | high | Migration/admin only | Server-side abuse controls; no RLS |
| `repositories` | `workspace_id`, legacy `user_id` | critical | RLS target; backend predicate | Workspace foreign key and indexes; no RLS |
| `repository_provider_usage` | `workspace_id`, `repository_id` | high | RLS target; backend predicate | Workspace/repository usage; no RLS |
| `repository_rescan_jobs` | `workspace_id`, `repository_id` | high | RLS target; worker/backend predicate | Workspace/repository job; no RLS |
| `scans` | `repository_id` → workspace | high | RLS target; backend predicate | Scan output and raw result; no RLS |
| `sessions` | `user_id` | critical | RLS target; migration/admin only for direct clients | Session identifiers and expiry; no RLS |
| `slack_action_tokens` | `workspace_id`, `finding_id` | critical | RLS target; migration/admin only for direct clients | Single-use action tokens; no RLS |
| `slack_connections` | `workspace_id` | critical | RLS target; backend predicate | Encrypted token material; no RLS |
| `slack_interaction_jobs` | `workspace_id`, `repository_id` | high | RLS target; worker/backend predicate | Slack action job and tenant fields; no RLS |
| `slack_notification_deliveries` | `workspace_id`, `repository_id` | high | RLS target; worker/backend predicate | Notification payload/result metadata; no RLS |
| `slack_notification_dismissals` | delivery → workspace | high | RLS target through delivery ownership | User dismissal record; no RLS |
| `slack_oauth_states` | `workspace_id`, `user_id` | critical | RLS target; migration/admin only for direct clients | OAuth state; no RLS |
| `slack_provider_change_deliveries` | `workspace_id` | high | RLS target; worker/backend predicate | Provider notification delivery; no RLS |
| `users` | user identity | high | RLS target; backend predicate | Account identity/password hash; no RLS |
| `worker_run_heartbeats` | global component/run identity; no tenant key | high | Migration/admin and approved worker/ops path | SEC-13 heartbeat/freshness and `error_code`; migration enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; no policy is defined |
| `workspace_member_revocation_requests` | `workspace_id`, subject/actor user IDs, membership ID | critical | RLS target; backend predicate; migration/admin for direct clients | Migration 027 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; idempotency/status/reason and retained membership identity; no policy is defined |
| `workspace_members` | `workspace_id`, `user_id` | critical | RLS target; backend predicate | Membership is the tenant authority; no RLS |
| `workspace_security_audit_events` | `workspace_id`, subject/actor user IDs, membership ID | critical | RLS target; backend predicate; migration/admin for direct clients | Migration 027 enables RLS and revokes `PUBLIC`, `anon`, `authenticated`; durable security event payload; no policy is defined |
| `workspace_subscriptions` | `workspace_id` | critical | RLS target; backend billing path | Entitlement state; no RLS |
| `workspace_usage` | `workspace_id` | high | RLS target; backend billing path | Usage counters; no RLS |
| `workspaces` | workspace identity | critical | RLS target; backend predicate | Tenant root; no RLS |

The OAuth tables are not complete tenant isolation: RLS is enabled without a policy, so access depends on the role and owner/bypass behavior. That is intentionally retained as a finding until role ownership and policy behavior are verified in staging.

## Current role and grant matrix

These are intended boundaries, not claims about the live database. The source currently collapses the first two roles into one connection path.

| Role boundary | Required authority | Current implementation | Verification state |
|---|---|---|---|
| `app_runtime` | DML on approved application tables; no role creation, DDL, ownership, or grant administration | `PostgresDatabaseAdapter` creates one pool from `DATABASE_URL`; migrations can run through the same adapter | NOT VERIFIED; role name and effective grants unavailable |
| `migration_admin` | DDL, migration ledger writes, indexes, constraints, and controlled data backfills | No separate connection or role; `runMigrations` executes on the application pool under a transaction/advisory lock | MISSING as a separation; requires approved rollout design |
| `ops_readonly` | Catalog and operational read-only access for verification/incident response | No configured role or tooling in this repository | NOT VERIFIED |
| `PUBLIC` | No access to application tables, functions, sequences, or schema beyond explicitly required defaults | No source-wide revoke/default-privilege migration | NOT VERIFIED |
| `anon` / `authenticated` | No direct access unless an approved client-facing SQL contract exists | Explicit table revokes exist only for four OAuth tables in migrations 022/023 | NOT VERIFIED for all other objects |
| Owner/superuser/bypass roles | Emergency/migration authority only; never used by request handlers | Runtime identity is not independently established in source | BLOCKED pending staging role read-back |

## Repeatable read-only PostgreSQL audit

Run the following as an approved read-only catalog role against an isolated staging-equivalent database. Capture role names and ACL results, never passwords, connection strings, or customer rows.

The query pack includes direct role-membership edges plus `pg_has_role` checks for direct/indirect membership and inherited privileges, effective schema `USAGE`/`CREATE`, and effective database `CONNECT`/`TEMP` alongside stored ACL arrays. It also checks effective relation, column, sequence, and function privileges for the intended role names, records explicit column ACLs, and exposes per-function configuration for `SECURITY DEFINER` review. These are complementary views: effective privilege inquiry functions account for inherited/PUBLIC authority, while ACL columns show explicit catalog ACL state. The role-membership fields used here are compatible with older PostgreSQL releases; newer releases expose additional membership options that should be added after the hosted PostgreSQL version is confirmed. See the official [role-membership catalog](https://www.postgresql.org/docs/current/catalog-pg-auth-members.html), [privilege inquiry functions](https://www.postgresql.org/docs/current/functions-info.html), and [database catalog](https://www.postgresql.org/docs/current/catalog-pg-database.html).

The role names below are the intended matrix labels. Confirm the actual role identity from the approved connection first and substitute owner-approved names if they differ. An absent intended role is a missing role contract, not evidence of zero privileges. Effective-object queries are limited to these named roles to keep catalog work bounded.

```sql
-- Effective roles and dangerous attributes
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolcanlogin, rolreplication, rolbypassrls
FROM pg_roles
ORDER BY rolname;

-- Direct role memberships and admin options
SELECT granted.rolname AS granted_role,
       member.rolname AS member_role,
       grantor.rolname AS grantor_role,
       membership.admin_option
FROM pg_auth_members membership
JOIN pg_roles granted ON granted.oid = membership.roleid
JOIN pg_roles member ON member.oid = membership.member
JOIN pg_roles grantor ON grantor.oid = membership.grantor
ORDER BY 1, 2, 3;

-- Effective direct or indirect membership and privileges available without SET ROLE
SELECT member.rolname AS member_role,
       granted.rolname AS granted_role,
       pg_has_role(member.oid, granted.oid, 'MEMBER') AS effective_member,
       pg_has_role(member.oid, granted.oid, 'USAGE') AS privileges_inherited_without_set_role
FROM pg_roles member
CROSS JOIN pg_roles granted
WHERE member.oid <> granted.oid
  AND pg_has_role(member.oid, granted.oid, 'MEMBER')
ORDER BY 1, 2;

-- Confirm connection identity for each approved runtime/migration/ops connection
SELECT session_user,
       current_user,
       current_setting('role', true) AS active_role_setting,
       current_database();

-- Report whether each intended role exists and its high-risk role attributes
WITH expected_roles(rolname) AS (
  VALUES ('app_runtime'), ('migration_admin'), ('ops_readonly')
)
SELECT expected.rolname,
       actual.oid IS NOT NULL AS role_exists,
       actual.rolcanlogin,
       actual.rolinherit,
       actual.rolsuper,
       actual.rolcreaterole,
       actual.rolcreatedb,
       actual.rolreplication,
       actual.rolbypassrls
FROM expected_roles expected
LEFT JOIN pg_roles actual ON actual.rolname = expected.rolname
ORDER BY expected.rolname;

-- Effective schema USAGE/CREATE, including inherited role grants and PUBLIC grants
SELECT gr.rolname,
       ns.nspname,
       pg_get_userbyid(ns.nspowner) AS owner_name,
       ns.nspacl,
       has_schema_privilege(gr.oid, ns.oid, 'USAGE') AS effective_usage,
       has_schema_privilege(gr.oid, ns.oid, 'CREATE') AS effective_create
FROM pg_roles gr
CROSS JOIN pg_namespace ns
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2;

-- Effective database CONNECT/TEMP and database owner/ACL state
SELECT gr.rolname,
       db.datname,
       pg_get_userbyid(db.datdba) AS owner_name,
       db.datacl,
       has_database_privilege(gr.oid, db.oid, 'CONNECT') AS effective_connect,
       has_database_privilege(gr.oid, db.oid, 'TEMP') AS effective_temp
FROM pg_roles gr
CROSS JOIN pg_database db
WHERE db.datallowconn
ORDER BY 1, 2;

-- Tables, owners, RLS state, and explicit ACLs
SELECT n.nspname AS schema_name, c.relname AS object_name,
       pg_get_userbyid(c.relowner) AS owner_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       c.relacl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY 1, 2;

-- Expanded table ACLs, including PUBLIC
SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3, 4;

-- Effective relation privileges for the intended runtime, migration, and ops roles
WITH audited_roles AS (
  SELECT oid, rolname
  FROM pg_roles
  WHERE rolname IN ('app_runtime', 'migration_admin', 'ops_readonly')
)
SELECT ar.rolname,
       ns.nspname,
       rel.relname,
       rel.relkind,
       has_table_privilege(ar.oid, rel.oid, 'SELECT') AS can_select,
       has_table_privilege(ar.oid, rel.oid, 'INSERT') AS can_insert,
       has_table_privilege(ar.oid, rel.oid, 'UPDATE') AS can_update,
       has_table_privilege(ar.oid, rel.oid, 'DELETE') AS can_delete,
       has_table_privilege(ar.oid, rel.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(ar.oid, rel.oid, 'REFERENCES') AS can_reference,
       has_table_privilege(ar.oid, rel.oid, 'TRIGGER') AS can_trigger,
       has_any_column_privilege(ar.oid, rel.oid, 'SELECT') AS can_select_any_column
FROM audited_roles ar
CROSS JOIN pg_class rel
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND rel.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY 1, 2, 3;

-- Explicit column-level ACLs; table-level ACLs are shown separately above
SELECT ns.nspname,
       rel.relname,
       attr.attname,
       attr.attacl
FROM pg_attribute attr
JOIN pg_class rel ON rel.oid = attr.attrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE attr.attnum > 0
  AND NOT attr.attisdropped
  AND attr.attacl IS NOT NULL
  AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;

-- Policies and their expressions
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
ORDER BY 1, 2, 3;

-- Function ACLs, effective execution by intended roles, and SECURITY DEFINER review fields
WITH audited_roles AS (
  SELECT oid, rolname
  FROM pg_roles
  WHERE rolname IN ('app_runtime', 'migration_admin', 'ops_readonly')
)
SELECT ar.rolname,
       n.nspname AS schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proleakproof,
       p.proconfig,
       p.proacl,
       has_function_privilege(ar.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN audited_roles ar
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3, 4;

-- Default privileges and sequence access
SELECT defaclrole::regrole AS owner_role, defaclnamespace::regnamespace AS schema_name,
       defaclobjtype, defaclacl
FROM pg_default_acl
ORDER BY 1, 2, 3;

SELECT sequence_schema, sequence_name, grantee, privilege_type, is_grantable
FROM information_schema.role_usage_grants
WHERE object_type = 'SEQUENCE'
ORDER BY 1, 2, 3, 4;

-- Effective sequence privileges for the intended runtime, migration, and ops roles
WITH audited_roles AS (
  SELECT oid, rolname
  FROM pg_roles
  WHERE rolname IN ('app_runtime', 'migration_admin', 'ops_readonly')
)
SELECT ar.rolname,
       ns.nspname,
       seq.relname,
       has_sequence_privilege(ar.oid, seq.oid, 'USAGE') AS can_use,
       has_sequence_privilege(ar.oid, seq.oid, 'SELECT') AS can_select,
       has_sequence_privilege(ar.oid, seq.oid, 'UPDATE') AS can_update
FROM audited_roles ar
CROSS JOIN pg_class seq
JOIN pg_namespace ns ON ns.oid = seq.relnamespace
WHERE seq.relkind = 'S'
  AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;
```

## Isolation test contract

The staging test must create two non-owner users and two workspaces, then exercise the following with the actual runtime and client-facing roles. Every denied operation must fail or return no row at the database boundary, not merely in a route helper:

1. Owner A reads and writes workspace A resources.
2. Member A reads permitted workspace A resources and is denied owner-only mutations.
3. Nonmember B cannot read or write workspace A by changing a URL, body, repository ID, finding ID, job ID, or workspace ID.
4. Owner B cannot read or write workspace A.
5. Direct reads of sessions, reset tokens, OAuth states/accounts, Slack ciphertext/action tokens, billing state, and migration patch content are denied to `anon`/`authenticated` unless explicitly approved.
6. A worker role can claim only its approved queue rows and cannot broaden a lease query by omitting tenant/repository scope.
7. A migration role can apply and roll back the reviewed migration but cannot be used by request handlers.
8. `SET ROLE` attempts, `row_security = off`, owner bypass, `SECURITY DEFINER`, function execution, sequence access, and default-privilege drift are tested explicitly.

The test is BLOCKED until an owner provides an isolated PostgreSQL database, non-production credentials for the named roles, and approval for temporary test records. Catalog ACL checks do not exercise row policies or demonstrate that `FORCE ROW LEVEL SECURITY` defeats owner/bypass behavior; those require the isolated role-based database tests in this contract. SQLite and route-only tests are evidence for backend predicates, not acceptance evidence for this task.

## Reviewed migration shape and rollback requirement

No RLS/grant migration is included in this checkpoint because the application does not yet set a trusted per-request tenant/user context on PostgreSQL connections and the runtime/migration roles are not separated. Applying policies now could either silently fail open through an owner/bypass role or break legitimate backend transactions.

The next implementation proposal, after role approval, is a separately reviewed migration that:

- creates or adopts named runtime, migration, and read-only operational roles;
- revokes `PUBLIC`, `anon`, and `authenticated` defaults and object privileges before granting the minimum required runtime set;
- adds `FORCE ROW LEVEL SECURITY` and explicit `USING`/`WITH CHECK` policies to tenant-root and tenant-derived tables;
- establishes a transaction-local, authenticated tenant context using a mechanism the hosting provider supports and the application can set before every query/transaction;
- keeps OAuth/session/token tables migration/admin-only unless a narrowly scoped policy is proven necessary;
- verifies ownership and `rolbypassrls` before enabling enforcement;
- is applied first to an empty disposable staging clone, then to a data-bearing staging clone after backup and rollback rehearsal;
- has a down/rollback procedure that restores the prior ACL/policy state from captured catalog output, with no destructive production fallback.

## Status

- 2026-11-08 local inventory reconciliation: compared unique `CREATE TABLE` names across `apps/web/src/lib/server/db/*.ts` against the matrix; the source contains 46 tables and the prior matrix listed 40. Added the six omitted tables above, including migrations 024–027 and SEC-13 heartbeats. This reconciles source documentation only; it does not establish that staging or production catalogs match.
- The local `database-access-matrix` test now also pins the ten tables whose matrix rows claim PostgreSQL RLS plus `PUBLIC`, `anon`, and `authenticated` revocations, and verifies those statements remain present in migration source. This is source-contract drift protection only; it does not prove the migration ran or effective grants/RLS behavior in PostgreSQL.
- The read-only catalog query pack now reports direct role memberships and effective inherited role/schema/database privileges; `database-access-matrix` tests pin those coverage points. No live database was queried, and the actual PostgreSQL version and effective grants remain unknown.
- Effective relation/column/sequence/function checks now target the three intended role labels, with explicit role-existence and connection-identity output; function configuration and explicit column ACLs are included for security review. These catalog queries are still unexecuted and do not prove row-level isolation, owner/bypass behavior, or actual hosted role names.
- SEC-01: `PARTIAL` — complete local source inventory and isolation contract; live role/RLS/policy read-back and PostgreSQL tests blocked.
- SEC-02: `PARTIAL` — role/grant/default-privilege audit query pack and intended matrix documented; effective grants and role separation blocked.
- No production or staging database was contacted or changed.
