# PR-07 GitHub webhook and post-merge integration gate

The integration branch already verifies signed webhook requests against the
raw body, claims delivery IDs atomically, rejects replayed deliveries, scopes
installation/repository identity to one workspace, rejects unsupported event
types, and queues default-branch push scans idempotently.

This slice adds the reusable `enqueueMergedPullRequestScan` boundary. It uses
the existing `github_scan_requests` uniqueness key `(repository_id, commit_sha)`
and the existing `scans` columns, so it is tested against a disposable local
SQLite schema without invoking GitHub or a production worker.

## Activation gate

The actual `pull_request` merged-event route remains unactivated. Wiring it
must update `pull_requests.merge_sha`, which belongs to migration
`026/finding_resolution_verification_evidence`. Before activation, obtain
approved isolated-database evidence for that migration identity, the
`pull_requests.merge_sha` column, the queue ledger, and the exact migration
history. Do not add, replay, rename, or renumber migration 026 on an ambiguous
database.

Live GitHub App permissions, webhook delivery, installation authorization,
host configuration, and post-merge worker execution remain external gates.
No test fixture performs a network callback, repository write, PR creation,
merge, or production scan.
