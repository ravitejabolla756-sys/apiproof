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

The new validator must run before DDL and reject unknown IDs, duplicate IDs, incomplete records, and ID/name conflicts. Historical rows remain unchanged.

## Supported fixture scenarios

- Fresh database: no ledger rows; compatible, all migrations pending.
- Member 1 legacy: compatible only against the Member 1 registry.
- Member 2 legacy: compatible only against the Member 2 registry.
- Mixed history: incompatible when the same ID has the other branch's name.
- Conflicting ID: incompatible for duplicate or unknown ledger records.
- Repeat execution: deterministic result and error ordering.

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
