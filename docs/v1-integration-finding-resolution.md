# PR-08 finding-resolution verification gate

The integration branch contains the source-grounded resolution classifier and
the lifecycle transition service. Local tests now cover completed-scan
absence, persistent findings, regressions, conflicting active changes, stale
or incomplete scans, and out-of-order evidence.

The post-merge worker write path remains disabled. Its source implementation
depends on all of the following migration-backed objects:

- `findings.lifecycle_state` and `finding_lifecycle_events` from
  `025/audited_finding_lifecycle`;
- `pull_requests.merge_sha` and `finding_resolution_verifications` from
  `026/finding_resolution_verification_evidence`;
- the PR-07 `github_scan_requests` record and an exact merged commit SHA;
- workspace/repository/finding identity agreement across the scan and merged
  pull request.

Before activation, approved isolated-database evidence must confirm the exact
migration ledger IDs, names, timestamps, checksums/fingerprints, columns,
constraints, unique idempotency keys, and queue history. Ambiguous or mixed
025/026 histories must fail closed. No automatic resolution, route activation,
or existing-database migration execution is allowed before that decision.

The local classifier tests are not proof of PostgreSQL locking, RLS, live
GitHub delivery, worker scheduling, or production scan persistence.
