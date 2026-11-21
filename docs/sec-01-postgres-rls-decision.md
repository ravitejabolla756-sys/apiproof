# SEC-01 PostgreSQL RLS verification decision

## Scope and current evidence

The integration branch contains workspace-scoped tables and application-level authorization predicates. The current PostgreSQL-specific migrations enable RLS and revoke default table access for these security-sensitive tables:

- `email_verification_tokens` in `email-verification-migration.ts`.
- `google_oauth_states` and `google_oauth_accounts` in `google-oauth-migration.ts`.
- `github_login_oauth_states` and `github_oauth_accounts` in `github-login-migration.ts`.
- `workspace_member_revocation_requests` and `workspace_security_audit_events` in `member-revocation-migration.ts`.

The static inventory confirms `ENABLE ROW LEVEL SECURITY` and `REVOKE ALL ... FROM PUBLIC, anon, authenticated` are present in those migration paths. It also confirms that no `CREATE POLICY`, `FORCE ROW LEVEL SECURITY`, or `SECURITY DEFINER` tenant policy implementation is currently present in the inspected integration sources. This is a gap to resolve, not evidence of acceptance.

The main application migrator is SQLite-oriented for local execution and contains migration IDs through the existing integration history. Migrations 024–027 remain unresolved collisions and were not changed.

## PostgreSQL evidence unavailable

No approved isolated PostgreSQL database was available during this checkpoint: no database connection variables were present, `psql` was unavailable, no local PostgreSQL process was running, and Docker Desktop's Linux engine was not reachable. No database connection or migration execution was attempted.

SQLite authorization tests remain supporting evidence only. They cannot prove PostgreSQL policy evaluation, `FORCE ROW LEVEL SECURITY`, grants, role inheritance, `current_setting` tenant context, security-definer behavior, or concurrent cross-tenant enforcement.

## Required isolated PostgreSQL verification

An owner-approved disposable PostgreSQL copy must provide its engine/version, schema and migration-ledger provenance, role inventory, and a non-secret connection method. The evidence run must use separate test roles and disposable tenant rows only, and must collect:

1. `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity` for every tenant-owned table.
2. `pg_policies` definitions, including permissive/restrictive mode, roles, `USING` and `WITH CHECK` expressions.
3. Effective grants from `information_schema.role_table_grants` and role membership/inheritance.
4. Session-context behavior for the approved tenant-setting mechanism.
5. Cross-tenant SELECT, INSERT, UPDATE, DELETE and function-call negatives.
6. Security-definer function owner, search path and privilege behavior, if any are introduced.
7. Results before and after revocation, invitation invalidation and audit-event writes.

The existing read-only template `docs/migration-history-evidence.postgres.sql` is limited to ledger and schema inventory; it does not execute policy tests or expose application rows.

## Acceptance decision

SEC-01 remains `BLOCKED_EXTERNAL`. The static checks are local preparation only. Owner approval, authoritative migration-ledger evidence, explicit tenant policies/grants, and real PostgreSQL isolation tests are required before RLS can be marked accepted or before any policy is enabled on an existing database.
