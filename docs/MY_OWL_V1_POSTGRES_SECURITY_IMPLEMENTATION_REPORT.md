# MY OWL V1 PostgreSQL Security Implementation Report

## Current result

The integration branch now contains a schema-grounded PostgreSQL tenant-security candidate and a transaction-scoped server authorization helper. The candidate is intentionally not registered in the application migrator because migration identities 024–027 and the trusted database-identity bridge remain unresolved.

## Implemented locally

- `apps/web/src/lib/server/db/postgres-tenant-context.ts`
  - Validates non-empty server-derived user/workspace identifiers.
  - Rechecks membership inside the same PostgreSQL transaction.
  - Locks the membership row with `FOR SHARE` for the protected transaction.
  - Sets `app.user_id` and `app.workspace_id` with transaction-local `set_config`.
  - Leaves SQLite behavior on the existing application authorization path.
- `docs/postgres-tenant-security-migration.sql`
  - Forward-only candidate for the reviewed workspace/repository schema.
  - Enables and forces RLS for established tenant tables.
  - Adds explicit membership-based policies for direct and repository-indirect ownership.
  - Revokes ambient `PUBLIC` table access.
  - Uses a fixed-search-path `SECURITY DEFINER` repository-access helper to avoid recursive RLS policy joins.
  - Is not registered or executed.
- `apps/web/src/lib/server/organization-service.ts`
  - Uses the existing tenant-context helper for workspace settings writes and organization-member reads on the PostgreSQL path.
- `tests/postgres-tenant-security.integration.test.ts`
  - Provisions disposable users, workspaces, repositories, application/migrator roles and candidate policies.
  - Covers authorized and cross-tenant reads, missing membership, revocation, pool/concurrent isolation, forced RLS and role separation.
  - Keeps arbitrary custom-GUC spoof resistance as an explicit TODO because PostgreSQL custom settings are not an independent identity provider.
- `.github/workflows/ci.yml`
  - Adds a bounded PostgreSQL 17.2 service job with ephemeral test-only credentials and health checks.
- `tests/postgres-tenant-context.test.ts`
  - Covers invalid context, missing membership, successful context boundary and SQLite compatibility.

## Schema scope

Direct workspace tables: `workspaces`, `workspace_members`, `github_installations`, `github_scan_requests`, `workspace_subscriptions`, and `workspace_usage`.

Repository-indirect tables: `repositories`, `scans`, `findings`, `migrations`, and `pull_requests`.

Excluded pending separate review: users, sessions, password/reset/OAuth token tables, `_apiproof_migrations`, global rate-limit state, webhook delivery ledger, and organization invitation/audit tables whose final migration provenance is still unresolved.

## Verification status

- PostgreSQL availability: blocked locally. Docker Desktop Linux engine is not running; `psql` is unavailable; no local PostgreSQL service was found.
- Local focused suite: 62 passed, 6 skipped, and 3 TODO across the organization/PostgreSQL regression selection; the new real-PostgreSQL file skipped because `TEST_POSTGRES_ADMIN_URL` was absent.
- Full local Vitest: 204 files passed, 2 skipped; 1,589 tests passed, 10 skipped, 20 TODO.
- Hosted real PostgreSQL RLS/grant tests: prepared in CI but not yet run; no hosted result is claimed.
- Real role-separation tests: pending hosted PostgreSQL execution.
- Existing production/staging databases: not accessed.

SQLite or mock results must not be used as PostgreSQL acceptance evidence.

## Required before activation

1. Owner-approved disposable PostgreSQL instance and separate nonproduction roles.
2. Actual migration-ledger and schema fingerprints for the target database.
3. Approval of the transaction identity bridge; custom settings are defense-in-depth and cannot independently authenticate a caller.
4. Syntax/application of the candidate against a fresh disposable PostgreSQL database.
5. Cross-tenant SELECT/INSERT/UPDATE/DELETE, revocation, pool-reuse and concurrency tests using the restricted application role.
6. Review of role ownership, default privileges, sequence grants, function execution and migration-role separation.
7. A new approved migration identity after 024–027 reconciliation.

## Release decision

SEC-01 and SEC-02 remain `BLOCKED_EXTERNAL`. MY OWL V1 remains **NO-GO** for production until real PostgreSQL policy/grant evidence and migration compatibility approval exist.
