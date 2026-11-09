# MY OWL V1 — Migration History Reconciliation Preparation

This document describes the read-only compatibility preparation branch. It does
not choose new migration IDs, mutate a database, or authorize a production or
staging migration.

## Observed collision

Both feature snapshots define IDs `024` through `027`, but the identities differ:

| ID | Member 1 identity | Member 2 identity |
|---|---|---|
| 024 | `email_verification_tokens_and_user_state` | `workspace_invitations_and_audit_events` |
| 025 | `audited_finding_lifecycle` | `user_notification_preferences` |
| 026 | `finding_resolution_verification_evidence` | `email_delivery_ledger` |
| 027 | `durable_workspace_member_revocation` | `slack_scan_failure_deliveries` |

The application ledger currently keys applied migrations by ID only. A database
with the other branch's name recorded for an ID would therefore skip the wrong
schema if the branches were concatenated directly.

## Validator

`apps/web/src/lib/server/db/migration-history-compatibility.ts` is a pure
validator. It does not open a database or execute SQL. It detects duplicate
ledger IDs, unknown migrations, ID/name conflicts, missing recorded objects and
mixed histories. `assertMigrationHistorySafe` fails closed for any issue.

The fixtures cover:

- a fresh database;
- a complete Member 1 legacy history;
- a complete Member 2 legacy history;
- a mixed history;
- a conflicting ID/name row;
- a ledger row whose schema objects are incomplete.

## Forward-only alternatives requiring approval

1. Preserve all existing `024–027` rows exactly.
2. Select one reviewed canonical sequence for fresh databases only.
3. Allocate the other branch's schemas new, unused IDs in the integrated
   registry after reviewing all applied histories.
4. Add compatibility migrations with new IDs that create only missing objects
   for legacy histories. They must be idempotent and must not rewrite or replay
   an applied ledger row.
5. Fail closed when a ledger name, schema fingerprint or object inventory is
   ambiguous.

The final allocation and any compatibility migration require owner/DBA review.
No numbering decision is made on this branch.

## Verification matrix

Every candidate integration database must be checked in a disposable isolated
environment as:

| Fixture | Required result |
|---|---|
| Empty database | All approved fresh migrations apply once in dependency order. |
| Member 1 legacy | Existing Member 1 rows remain unchanged; only approved missing Member 2 schema is added. |
| Member 2 legacy | Existing Member 2 rows remain unchanged; only approved missing Member 1 schema is added. |
| Mixed history | Preflight blocks until a reviewed compatibility path is selected. |
| Repeated run | Zero new objects or ledger rows after the first successful run. |
| Concurrent PostgreSQL startup | One migration owner; no partial ledger rows or duplicate schema failures. |
