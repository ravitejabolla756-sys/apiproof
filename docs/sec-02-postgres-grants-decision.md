# SEC-02 PostgreSQL grants and role separation

## Source findings

The application selects PostgreSQL when `DATABASE_URL` or `APIPROOF_DATABASE_URL` is configured and creates a pooled `PostgresDatabaseAdapter`. The migrator and application currently share that adapter boundary; source inspection does not establish distinct PostgreSQL database roles or effective grants.

Current migration code revokes default access from `PUBLIC`, `anon`, and `authenticated` for selected sensitive tables and enables RLS on those tables. SEC-01 separately records that no explicit tenant `CREATE POLICY` or `FORCE ROW LEVEL SECURITY` definitions were found in the inspected source.

The source-level TLS boundary rejects remote `sslmode=disable` connections and requires certificate validation for non-local connections. No connection string, password, role secret, or live grant state was inspected.

## Required disposable PostgreSQL evidence

`docs/sec-02-postgres-grants.sql` is a read-only metadata template. It must be run separately as the approved application role and migrator role against an isolated PostgreSQL copy. The sanitized evidence must include:

- `current_user`, `session_user`, database name and PostgreSQL version.
- `rolsuper`, `rolcreaterole`, `rolcreatedb`, `rolinherit`, and `rolbypassrls`.
- Public-schema `USAGE` and `CREATE` privileges.
- Read/write privileges on `_apiproof_migrations`.
- Effective table grants and role memberships.
- RLS/force-RLS flags and policy definitions for tenant-owned tables.
- A comparison showing the application role cannot create schema, disable RLS, alter grants, manage the migration ledger, or impersonate the migrator role.

The script does not read application rows, passwords, private keys, tokens, or connection strings. Role names may be recorded as approved non-secret identifiers; credentials must never be placed in the evidence artifact.

## Current blocker and acceptance gate

No approved isolated PostgreSQL cluster, `psql` client, or running local Postgres instance was available during this checkpoint. Docker Desktop's PostgreSQL engine was also unavailable. Consequently, no effective grant or role-separation claim can be made from SQLite tests, source inspection, or mocks.

SEC-02 remains `BLOCKED_EXTERNAL` until the owner supplies an isolated database, approved non-production roles, migration-ledger provenance, and authorization to run the read-only evidence script. Application/migrator role separation must be established before any production migration or RLS acceptance.
