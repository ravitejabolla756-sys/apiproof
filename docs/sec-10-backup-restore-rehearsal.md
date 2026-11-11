# SEC-10 backup and restore rehearsal plan

## Current evidence boundary

The repository documents PostgreSQL backup expectations, migration-ledger evidence, retention assumptions, and rollback boundaries. Those documents are design requirements only. No live backup, production snapshot, staging snapshot, object-store copy, or restore measurement was accessed in this checkpoint. Any nominal RPO/RTO values in older documentation remain unverified and must not be reported as achieved.

SEC-10 remains `BLOCKED_EXTERNAL` until an owner-approved disposable source and isolated destination are available.

## Required approval package

Before execution, the owner must provide a non-secret approval reference for:

- source backup or snapshot identifier, engine/version, creation time and retention window;
- destination database and object-storage isolation controls;
- approved operator and least-privilege restore role;
- backup encryption/key ownership and break-glass access procedure;
- migration-ledger provenance, including the applied IDs/names and schema fingerprint;
- job/queue state and object-storage scope to restore;
- configuration allowlist with secrets injected out-of-band;
- target RPO/RTO values, measurement clock and pass/fail thresholds;
- escalation owner, stop conditions and manual rollback authority.

No credentials, URLs, customer rows, backup contents or key material belong in the evidence report.

## Non-destructive dry-run sequence

1. Validate the approval reference and confirm the source is non-production or an approved immutable copy.
2. Record source engine/version, snapshot timestamp, backup manifest digest, object-store object count/bytes, and configuration names only.
3. Verify the destination is empty or disposable, isolated from production networking, and cannot receive application traffic.
4. Restore the database and approved object subset using the provider's documented restore operation. Do not run application migrations automatically.
5. Collect the restored migration ledger and compare IDs, names, timestamps, and schema fingerprints with the approved source evidence. Stop on unknown, duplicate, mismatched, or partial history.
6. Verify table/index/constraint counts, required job and audit state, role grants, RLS flags/policies, and application boot using test-only configuration.
7. Run cross-tenant read/write negatives and a bounded application health check against disposable tenants only.
8. Measure elapsed restore-to-boot time and recovered data point versus the source snapshot. Record actual measurements; never substitute target RPO/RTO values.
9. Exercise rollback by discarding the isolated destination or restoring it to its pre-rehearsal state. Do not delete or alter the source backup.
10. Preserve sanitized logs, command versions, digests, timestamps, failures, and operator approvals.

## Acceptance criteria

Acceptance requires a completed restore with no data-loss or ledger-corruption finding, successful application boot, verified role/grant and tenant-isolation checks, recorded actual RPO/RTO measurements, and an owner-approved rollback record. SQLite fixtures and mocked restore calls are supporting contract evidence only.

## Current next action

Obtain the approval package and an isolated disposable restore destination. Then execute the sequence with the existing migration compatibility guard and SEC-01/SEC-02 PostgreSQL evidence templates. Do not rename, replay, or repair migration IDs 024–027 during the rehearsal.
