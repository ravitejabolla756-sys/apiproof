# MY OWL V1 — Migration Integration Decision Package

Status: preparation only. This package is read-only guidance for Member 1,
Member 2, and the approved database owner. It does not select migration
numbers, execute SQL, or authorize a staging/production change.

## Reviewed migration identities

| ID | Member 1 objects | Member 2 objects | Primary prerequisites |
|---|---|---|---|
| 024 | `users.email_verified_at`; `email_verification_tokens` plus user/expiry indexes | `workspace_invitations` plus workspace/email indexes; `workspace_audit_events` plus workspace index | `users`; Member 2 also requires `workspaces` |
| 025 | `findings.lifecycle_state`; `finding_lifecycle_events` plus finding/workspace/repository indexes | `user_notification_preferences` plus user/update index | Member 1 requires `findings`, `repositories`, `workspaces`, `users`; Member 2 requires `users` |
| 026 | `pull_requests.merge_sha`; `finding_resolution_verifications` plus finding/workspace indexes | `email_deliveries` plus claim/recipient/workspace indexes | Member 1 requires `pull_requests`, `migrations`, `findings`, `scans`, `repositories`, `workspaces`; Member 2 requires `users`, `workspaces` |
| 027 | `workspace_member_revocation_requests` plus workspace/subject indexes; `workspace_security_audit_events` plus workspace/subject indexes | `slack_scan_failure_deliveries` plus claim/workspace indexes | Member 1 requires `workspaces`; Member 2 requires `workspaces`, `repositories`, `github_scan_requests`, `slack_connections` |

Member 1’s PostgreSQL migrations also enable RLS and revoke public,
anonymous, and authenticated table privileges on the new security tables.
Member 2 applies the same boundary to its invitation, audit, notification,
email, and Slack tables. Effective policies and grants must be verified in
the approved database; source DDL is not runtime evidence.

## Required database evidence

The approved operator must provide a sanitized evidence packet containing:

1. Engine, server version, database identifier, current role, and a timestamp.
2. Complete `_apiproof_migrations` rows for IDs `001–027`, including `id`,
   `name`, and `applied_at`; do not provide connection strings or credentials.
3. Duplicate-ID and duplicate-name checks.
4. For every object above: existence, columns, types, nullability, defaults,
   primary/foreign/unique/check constraints, and indexes.
5. PostgreSQL RLS enabled/forced state, policies, effective table grants, and
   relevant default privileges; or SQLite table/index/trigger definitions.
6. The source commit and migration-registry digest used to interpret the
   evidence.
7. A sanitized backup/PITR identifier before any rehearsal.

Use the existing `docs/postgres-tenant-isolation-verification.sql` only in an
approved isolated PostgreSQL environment. For SQLite, run the equivalent
read-only queries:

```sql
SELECT id, name, applied_at FROM _apiproof_migrations ORDER BY id;
PRAGMA table_info('workspace_invitations');
SELECT type, name, tbl_name, sql FROM sqlite_master
WHERE tbl_name IN ('workspace_invitations', 'workspace_audit_events')
ORDER BY tbl_name, type, name;
```

Repeat `PRAGMA table_info` and the `sqlite_master` query for each required
object. The operator must save results as evidence, not modify the database.

## Safe history decisions

### Fresh database

No ledger rows exist. The teams may select one reviewed canonical sequence for
the integrated registry, but the sequence is not approved by this package.
Fresh execution must apply dependencies in order, record each ID once, and pass
the repeat-run and concurrent-startup checks.

### Member 1 legacy database

If `024–027` match Member 1 names and objects, preserve those rows exactly.
Member 2 schema must be introduced only through approved unused forward IDs or
an approved compatibility migration. Never reuse or replay Member 2’s original
`024–027` identities.

### Member 2 legacy database

If `024–027` match Member 2 names and objects, preserve those rows exactly.
Member 1 schema must be introduced only through approved unused forward IDs or
an approved compatibility migration. Never reinterpret the existing rows as
Member 1 migrations.

### Mixed or ambiguous history

Block automatic migration. A mixed ledger, an ID/name mismatch, missing
recorded objects, duplicate IDs, or an unexpected schema fingerprint requires a
database-owner decision. Take an approved backup, produce a per-database
mapping, and use a forward-only compatibility path only after review.

No path may rename, renumber, delete, or replay an already applied migration.

## ORG-10 integration handoff

Member 2’s `DELETE /api/workspace/members` route must delegate to Member 1’s
`revokeWorkspaceMember` boundary. The current Member 2 implementation deletes
all sessions for the target user; that is incompatible and must not survive
integration.

The shared transaction must:

1. Resolve the workspace and actor from the current authenticated membership.
2. Lock/re-read membership rows and enforce final-owner protection.
3. Load the target user email server-side.
4. Revoke all matching pending invitations in the same workspace transaction.
5. Delete only the selected `workspace_members` row.
6. Preserve personal sessions, other workspace memberships, and unrelated data.
7. Persist the durable Member 1 revocation request/security event.
8. Persist the Member 2 audit projection using the same event identity.
9. Enforce idempotency and reject key reuse with different parameters.
10. Require queued user-attributed workers to re-check membership before work.

Required integration tests:

- unauthorized, outsider, cross-tenant, and unknown-role requests;
- stale workspace context and stale session after revocation;
- pending invitation invalidation;
- concurrent invitation acceptance versus revocation;
- concurrent owner removal and final-owner protection;
- duplicate and conflicting idempotency keys;
- exactly-once durable audit event and UI projection;
- preservation of unrelated sessions and independently authorized jobs.

## Decisions not yet approvable

- Final fresh-database numbering and compatibility IDs.
- Treatment of databases whose ledger names match neither branch.
- PostgreSQL locking/isolation level and migration startup behavior.
- RLS policy ownership and effective role grants.
- Whether a compatibility migration may create missing objects in a mixed
  history or must require manual DBA repair.
- Final ORG-10 response/error contract and audit metadata with Member 2.
- Member 2’s actual latest commit; the reported `97b0669` is unavailable.

## Handoff action

Member 2 should provide the actual latest commit and clean migration/schema
snapshot. The database owner should return the sanitized evidence packet. Only
then should a disposable integration worktree perform the approved forward-only
reconciliation and combined ORG-10 tests.
