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

The integrated `pull_request` merged-event route now validates the
authoritative 40-character `merge_commit_sha` and transactionally enqueues the
existing local scan request and pending scan. It deliberately does not write
`pull_requests.merge_sha` or activate PR-08 resolution reconciliation, because
that column belongs to migration `026/finding_resolution_verification_evidence`.
Before enabling that persistence path, obtain approved isolated-database
evidence for migration 026, the `pull_requests.merge_sha` column, the queue
ledger, and the exact migration history. Do not add, replay, rename, or
renumber migration 026 on an ambiguous database.

Live GitHub App permissions, webhook delivery, installation authorization,
host configuration, and post-merge worker execution remain external gates.
No test fixture performs a network callback, repository write, PR creation,
merge, or production scan.
