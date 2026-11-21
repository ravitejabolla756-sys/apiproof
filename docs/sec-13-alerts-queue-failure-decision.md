# SEC-13 alert and queue-failure decision

## Existing bounded worker behavior

The scan worker already caps each invocation at 20 jobs and 270 seconds, uses a ten-minute lease, recovers expired work, and uses PostgreSQL `FOR UPDATE SKIP LOCKED` for atomic claims. Retryable scan failures are bounded by the existing worker-state policy at three attempts. Repository-rescan and notification workers have their own persisted attempt limits and lease recovery. Existing local tests cover worker death/timeout recovery, duplicate claims, stale leases, failure categories, and idempotent finding persistence.

These are local source and fixture controls. They do not prove PostgreSQL slow-query behavior, process termination recovery in hosted infrastructure, or alert delivery.

## Local implementation boundary

`alert-policy.ts` validates an owner-approved threshold and cooldown configuration and evaluates queue lag, retry storms, worker failures, and duplicate jobs. It has no production defaults, emits no network requests, and returns `policy_unavailable` when thresholds are missing or malformed. It is intentionally not wired to a paging provider.

The scan-worker metrics now expose `stalledJobs`, counting processing requests whose persisted lease has expired. This is a bounded local health signal only; lease recovery remains the worker's execution responsibility and alert emission still requires approved thresholds and an external monitoring destination.

## Decisions required before alert activation

- Queue-lag, retry-storm, worker-failure, duplicate-job, billing-error, and request-failure thresholds.
- Measurement windows, cooldown/deduplication behavior, rate limits, and alert grouping.
- Monitoring provider, destinations, on-call ownership, severity mapping, escalation and quiet hours.
- Worker-death, PostgreSQL slow-query, database lock, restore, and provider-outage rehearsal scope.
- Retention, privacy boundaries, redaction review, and incident-access audit requirements.

## Acceptance boundary

SEC-13 remains `BLOCKED_EXTERNAL`. Local tests prove only bounded queue controls and pure alert evaluation. Hosted paging, PostgreSQL query/lock rehearsal, process-kill recovery, and alert-threshold acceptance require an owner-approved nonproduction environment and documented thresholds.
