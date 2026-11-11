# SEC-11 observability and monitoring contract

## Local implementation

The integration branch now contains a provider-neutral telemetry boundary with four bounded metric names: request failures, scan queue lag, billing errors, and worker failures. `LocalTelemetry` is a disposable in-memory collector for tests and local diagnostics. `getTelemetrySink()` returns a no-op sink unless a caller explicitly supplies a sink; no vendor SDK, network exporter, dashboard, or production hook is enabled.

Telemetry attributes are allowlisted and redact credential/PII-like keys, including authorization, cookies, email, IP, user, workspace, tenant, token, secret, URL, and credential fields. String values are bounded. The local collector does not persist data across processes.

Existing route errors remain code-oriented and sanitized. This module does not replace existing authorization, migration, health, queue, or billing behavior and does not claim hosted monitoring coverage.

## Owner decisions required before hosted activation

- Monitoring provider and approved regional data-processing boundary.
- Log, metric, trace, and audit retention periods, deletion process, and legal/privacy review.
- Alert destinations, escalation ownership, on-call schedule, severity thresholds, deduplication and rate limits.
- Queue-lag, worker-failure, billing-error, request-failure, backup, and health alert thresholds.
- Whether workspace/repository identifiers may be represented by approved one-way hashes; raw tenant identifiers and PII remain prohibited by default.
- Sampling, payload-size limits, incident access, vendor support access, and break-glass auditing.
- Staging verification of alert delivery, outage behavior, and recovery notification.

## Acceptance boundary

SEC-11 remains `BLOCKED_EXTERNAL` until the owner approves the provider, retention and privacy decisions and a disposable staging environment verifies alerts, redaction, escalation, and failure recovery. Local tests prove only the bounded no-op/in-memory contract, not hosted monitoring or operational SLOs.
