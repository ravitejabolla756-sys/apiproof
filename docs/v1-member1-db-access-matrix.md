# MY OWL V1 — Database RLS and Least-Privilege Access Matrix

Status: local source inventory and staging test contract only. No database connection, production SQL, grant change, RLS policy change, or customer data access was performed.

Date: 2026-11-06
Worktree: `C:\YC-my-owl-v1-member1`
Branch: `codex/v1-backend-security`

## Scope and evidence boundary

This inventory covers every `CREATE TABLE IF NOT EXISTS` declaration under `apps/web/src/lib/server/db/` in the isolated worktree. The source contains 40 distinct tables. The PostgreSQL adapter, migration runner, and migration modules were read directly because the codebase-memory index reported metadata changes after the security edits.

The application currently uses a single `DATABASE_URL`/`APIPROOF_DATABASE_URL` connection pool for both normal queries and migrations. The source does not define database roles, `GRANT`, `CREATE POLICY`, `CREATE ROLE`, `ALTER DEFAULT PRIVILEGES`, `SET ROLE`, or a tenant session variable. Therefore local SQLite/application authorization tests cannot prove PostgreSQL role isolation or RLS behavior.

## Table-by-table decision

`Backend predicate` means the existing application must continue to scope access through authenticated user/workspace/repository joins even after database controls are added. `RLS target` means an approved PostgreSQL design should protect the table when accessed by a non-owner runtime role. `Migration/admin only` means the table should not be exposed to client-facing database roles.

| Table | Tenant/user key or relationship | Sensitivity | Decision | Current source evidence |
|---|---|---:|---|---|
| `_apiproof_migrations` | none | high | Migration/admin only | Created by the migration runner; no RLS/grant contract |
| `activity_events` | `user_id`, optional `repository_id` → workspace | high | RLS target; backend predicate | User/repository rows are persisted; no RLS in base schema |
| `billing_webhook_events` | provider event, no tenant key | high | Migration/admin only; backend webhook path | Idempotency table; no RLS/grant contract |
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
| `workspace_members` | `workspace_id`, `user_id` | critical | RLS target; backend predicate | Membership is the tenant authority; no RLS |
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

```sql
-- Effective roles and dangerous attributes
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolcanlogin, rolreplication, rolbypassrls
FROM pg_roles
ORDER BY rolname;

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

-- Policies and their expressions
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
ORDER BY 1, 2, 3;

-- Functions, execution ACLs, and SECURITY DEFINER bypass candidates
SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proleakproof, p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1, 2, 3;

-- Default privileges and sequence access
SELECT defaclrole::regrole AS owner_role, defaclnamespace::regnamespace AS schema_name,
       defaclobjtype, defaclacl
FROM pg_default_acl
ORDER BY 1, 2, 3;

SELECT sequence_schema, sequence_name, grantee, privilege_type, is_grantable
FROM information_schema.role_usage_grants
WHERE object_type = 'SEQUENCE'
ORDER BY 1, 2, 3, 4;
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

The test is BLOCKED until an owner provides an isolated PostgreSQL database, non-production credentials for the named roles, and approval for temporary test records. SQLite and route-only tests are evidence for backend predicates, not acceptance evidence for this task.

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

- SEC-01: `PARTIAL` — complete local source inventory and isolation contract; live role/RLS/policy read-back and PostgreSQL tests blocked.
- SEC-02: `PARTIAL` — role/grant/default-privilege audit query pack and intended matrix documented; effective grants and role separation blocked.
- No production or staging database was contacted or changed.
