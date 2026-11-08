# MY OWL V1 — Digest notification contract proposal

Status: proposal for owner and Member 1 review. This document does not authorize a digest worker, database migration, provider delivery, or customer-facing cadence.

## Safety boundary

Digest notifications must be derived from durable, tenant-scoped events and must not infer delivery from an in-memory queue or a successful provider request. Security and account-recovery messages remain transactional; they must never be delayed into a digest. Until this proposal is approved and the event/retention contract is integrated, the product must continue to state that digest delivery is unavailable.

## Proposed read model

The digest builder should read only events that are already authorized for the recipient at send time. Each candidate event should carry, or resolve through the authoritative service, the following bounded fields:

| Field | Requirement |
|---|---|
| `event_id` | Stable source-event identity used for deduplication; never use rendered text as identity |
| `workspace_id` | Tenant scope; reject events without a workspace for workspace digests |
| `recipient_user_id` | Resolved recipient, not an untrusted email supplied by a client |
| `category` | Allowlisted product category such as findings, scan outcomes or migration activity |
| `occurred_at` | UTC source timestamp; never replace with worker time |
| `payload_ref` | Redacted reference to the durable event; do not copy repository source or secrets into the digest row |
| `authorization_version` | Optional revision or membership snapshot for auditability; send-time authorization remains authoritative |

The digest read model should store a deterministic grouping key, recipient, workspace, category, source-event IDs, window start/end, template version, and delivery state. It should not store provider tokens, passwords, raw repository content, or payment data.

## Proposed state transitions

1. A reviewed product event is eligible only when its category is allowlisted and its retention window has not expired.
2. A scheduler creates at most one pending digest per recipient/workspace/category/window key.
3. The worker rechecks recipient preference, membership, workspace authorization and event retention immediately before rendering and again before provider I/O when the provider boundary permits it.
4. A successful provider handoff records the provider event ID and an immutable idempotency key. A timeout remains `delivery_unknown`; it must not be blindly replayed.
5. Retryable failures use bounded exponential backoff and a lease. Permanent failures move to a reviewable dead-letter state without exposing message content in logs.
6. A membership or preference change suppresses future delivery but does not rewrite historical delivery records.

## Decisions required before implementation

The following are intentionally unresolved and require explicit owner/Member 1 decisions:

- cadence and timezone policy: daily/weekly, recipient timezone source, DST behavior and the cutoff window;
- included categories and priority ordering, including whether a quiet-hours policy exists;
- preference key and default: opt-in versus opt-out, and whether each workspace or user controls it;
- event retention and maximum events/characters per digest;
- scheduler ownership, missed-run behavior, lease duration and clock source;
- approved email/provider contract, template versioning, unsubscribe behavior and delivery domain;
- whether Slack is a separate digest channel or remains event-by-event;
- redaction rules for finding, repository, migration and workspace names;
- audit taxonomy for scheduled, suppressed, rendered, handed-off, failed and deduplicated states.

No implementation should choose defaults for these items silently. An unresolved item stays `PENDING_APPROVAL` in the integration checklist.

## Minimum acceptance evidence after approval

- deterministic window-boundary and recipient-timezone tests, including DST transition behavior;
- duplicate and reordered source-event tests proving one digest per idempotency key;
- preference, membership removal, cross-workspace and expired-event suppression tests at send time;
- empty, oversized, redacted, provider-timeout, retry and dead-letter states;
- provider-controlled sink evidence with no secrets or sensitive payloads in logs;
- retention and audit-record tests against the approved Member 1 event contract;
- focused browser evidence for loading, unavailable, success and retry states only after the backend contract exists.

Until those decisions and tests exist, NOT-10 remains blocked for implementation and no digest delivery should be represented as live.
