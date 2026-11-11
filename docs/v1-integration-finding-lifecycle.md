# IMP-09 finding lifecycle integration gate

The Member 1 lifecycle service and resolution classifier are present in this
integration branch as an unactivated source slice. No finding route, worker
path, migration registry entry, or existing database schema is changed by
this slice.

## Required schema evidence before activation

The approved isolated database evidence package must show, for the same
database and migration ledger:

- migration identity `025/audited_finding_lifecycle`;
- `findings.lifecycle_state` and its legacy-status backfill behavior;
- `finding_lifecycle_events` with tenant identifiers, immutable transition
  fields, and a unique `idempotency_key`;
- migration identity `026/finding_resolution_verification_evidence`;
- `pull_requests.merge_sha`;
- `finding_resolution_verifications` with workspace, repository, finding,
  migration, pull request, scan, classification, evidence, and unique
  idempotency fields;
- the migration ledger's exact IDs, names, timestamps, and checksums or
  equivalent identity evidence.

The integration baseline currently has unresolved collisions for migration
IDs 025 and 026. Therefore these services must not be registered with the
real migrator, and the findings routes must not call them until the ledger
and schema evidence is reconciled without renumbering or replaying applied
migrations.

## Behavioral contract

Lifecycle transitions are workspace-scoped, conditional on the current state,
idempotent by key, and rejected when the key is reused for another finding,
workspace, or target state. `verified_resolved` requires a completed scan for
the same repository. Resolution classification is `resolved`, `unresolved`,
`regressed`, `ambiguous`, or `inconclusive`; none grants merge or deployment
authority.

The current tests prove only the vocabulary and pure classification behavior.
Database transition, tenant authorization, duplicate-event, concurrent-update,
and exact-commit persistence tests remain blocked until the 025/026 schema and
ledger are approved.
