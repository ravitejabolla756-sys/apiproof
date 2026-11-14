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
  - Is not registered or executed.
- `tests/postgres-tenant-context.test.ts`
  - Covers invalid context, missing membership, successful context boundary and SQLite compatibility.

## Schema scope

Direct workspace tables: `workspaces`, `workspace_members`, `github_installations`, `github_scan_requests`, `workspace_subscriptions`, and `workspace_usage`.

Repository-indirect tables: `repositories`, `scans`, `findings`, `migrations`, and `pull_requests`.

Excluded pending separate review: users, sessions, password/reset/OAuth token tables, `_apiproof_migrations`, global rate-limit state, webhook delivery ledger, and organization invitation/audit tables whose final migration provenance is still unresolved.

## Verification status

- PostgreSQL availability: blocked. Docker Desktop Linux engine is not running; `psql` is unavailable; no local PostgreSQL service was found.
- Real PostgreSQL RLS/grant tests: not run.
- Real role-separation tests: not run.
- Local tenant-context contract tests: pending execution.
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
