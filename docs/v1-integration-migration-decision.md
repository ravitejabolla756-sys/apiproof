# MY OWL V1 Migration Compatibility Decision Package

## Scope

This package is a read-only integration-preparation slice. It validates migration identity before DDL is allowed to run. It does not apply, rename, renumber, or replay migrations.

## Exact collisions

| ID | Member 1 | Member 2 |
| --- | --- | --- |
| 024 | `email-verification-migration.ts` / `email_verification` | `organization-migration.ts` / `workspace_invitations_and_audit_events` |
| 025 | `finding-lifecycle-migration.ts` / `finding_lifecycle` | `notification-migration.ts` / `notification_preferences` |
| 026 | `finding-resolution-migration.ts` / `finding_resolution_verification` | `email-delivery-migration.ts` / `email_delivery_ledger` |
| 027 | `member-revocation-migration.ts` / `workspace_member_revocation` | `scan-failure-notification-migration.ts` / `slack_scan_failure_deliveries` |

## Existing ledger and migrator assumptions

The current ledger is `_apiproof_migrations(id TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`. The current migrator checks only whether `id` exists, then skips the migration. It does not compare the stored name with the registered migration name before executing later migrations. PostgreSQL migration execution is protected by an advisory transaction lock; each migration and ledger insert are transaction-scoped.

The new validator must run before DDL and reject unknown IDs, duplicate IDs, incomplete records, ID/name conflicts, missing expected schema objects, and unexpected schema objects when schema evidence is supplied. Historical rows remain unchanged. The validator is currently standalone; the actual migrator is not protected by it.

Read-only evidence templates are provided in `docs/migration-history-evidence.sqlite.sql` and `docs/migration-history-evidence.postgres.sql`. They collect ledger rows, engine/version metadata, object names and structural metadata without selecting application records, passwords, tokens, or credentials. They have not been executed.

## Supported fixture scenarios

- Fresh database: no ledger rows; compatible, all migrations pending.
- Member 1 legacy: compatible only against the Member 1 registry.
- Member 2 legacy: compatible only against the Member 2 registry.
- Mixed history: incompatible when the same ID has the other branch's name.
- Conflicting ID: incompatible for duplicate or unknown ledger records.
- Repeat execution: deterministic result and error ordering.
- Partially applied schema: missing expected object fails closed.
- Unexpected schema object: fails closed when evidence is supplied.
- SQLite and PostgreSQL evidence are modeled separately.

## Unresolved evidence

Before selecting replacement IDs, obtain from an approved isolated database:

1. Every `_apiproof_migrations` row: `id`, `name`, `applied_at`.
2. Schema object fingerprints for all four collision families.
3. Database engine/version and migration runner version.
4. Whether any historical migration was manually applied or partially committed.
5. Whether a database contains Member 1-only, Member 2-only, or mixed objects under the same ledger ID.

## Candidate strategies requiring approval

1. Preserve Member 1 IDs and assign new IDs to Member 2-only migrations.
2. Preserve Member 2 IDs and assign new IDs to Member 1-only migrations.
3. Introduce a reviewed compatibility map that maps legacy identity `(id,name)` to one canonical forward-only migration identity.

No strategy is approved until real ledger evidence and backward-compatible upgrade tests are reviewed. Applied IDs must never be renamed or replayed.

## Production migrator safety design

Before migration DDL, the runner should read the complete ledger and compare every recorded `(id, name)` pair with the checked-in registry. It must fail closed on duplicate IDs, unknown IDs, ID/name mismatches, malformed records, and evidence of incomplete schema state. The comparison must be deterministic and must not mutate the ledger.

For PostgreSQL, retain the existing advisory transaction lock and run preflight, migration DDL, and ledger inserts on the same transaction-owned connection. For SQLite, acquire the adapter's write transaction before preflight and retain it through DDL and ledger writes; do not use a separate connection for validation. A failed preflight must execute no migration DDL.

Recovery requires preserving the database and ledger, capturing the read-only evidence package, identifying the exact incompatible identity, and applying an approved forward-only compatibility migration or mapping. Do not delete ledger rows, rename applied migrations, or replay DDL manually.

The guard must not be enabled until tests cover fresh, both legacy, mixed, duplicate, unknown, incomplete, partial-schema, unexpected-schema, repeat-run, SQLite, PostgreSQL, lock contention, rollback, and no-DDL-on-failure behavior.

The integration branch now covers the runner's identity preflight, SQLite no-pending-DDL behavior, unchanged ledger/schema state after rejection, repeat execution after repair, and PostgreSQL mock ordering for advisory lock, preflight, and rollback. The PostgreSQL cases are adapter-mock evidence only; they do not prove live PostgreSQL locking, RLS, grants, or engine behavior. Schema fingerprints and partially applied DDL still require approved isolated database evidence.

## Integration sequence

1. Obtain isolated database evidence.
2. Approve the compatibility strategy and migration identity map.
3. Add the preflight guard to the integration branch.
4. Integrate Member 1 authorization/revocation and Member 2 invitation/audit behavior.
5. Resolve shared billing, notification, package, lockfile, and workflow changes.
6. Run the full migration, security, organization, billing, notification, typecheck, lint, and build matrix.

Owner approval is required for the identity strategy, database access, PostgreSQL roles/RLS, and any forward-only compatibility migration.
