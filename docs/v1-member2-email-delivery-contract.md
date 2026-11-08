# MY OWL V1 — Transactional email contract proposal

Status: proposal for owner, Member 1, privacy/legal and operations review. This document does not select a provider, send email, enable SMTP, or authorize a production worker.

## Safety boundary

Security and account-recovery messages are required-message categories. They must not be silently suppressed by optional notification preferences, and they must not be reported as delivered because a request was queued. The existing non-production sink remains test-only; production must use an approved provider/domain or fail closed as unavailable.

## Proposed event contract

Every email event should be created by the authoritative server-side action with:

| Field | Requirement |
|---|---|
| `event_id` | Immutable source-event identity; stable across retries |
| `event_key` | Unique idempotency key scoped to the event, recipient and template version |
| `category` | Allowlisted `account_security`, `account_recovery`, `workspace_invitation` or approved optional category |
| `template_key/version` | Reviewed template identity and version; no client-selected template |
| `recipient_user_id` | Server-resolved user identity; email address is resolved server-side |
| `workspace_id` | Required for workspace-scoped messages and membership checks |
| `created_at/expires_at` | UTC timestamps; tokens and links must honor their own expiry |
| `payload_ref` | Redacted durable reference; raw tokens and message bodies stay out of the ledger |

The existing `email_deliveries` ledger can remain metadata-only. Its `pending`, `processing`, `delivered` and `failed` states, lease, attempt count, next-attempt time and redacted error category must remain authoritative for delivery state.

## Authorization and rendering

- Required security/recovery events may be sent only for the authenticated or server-verified account action that created them.
- Invitation events must bind the recipient to the hashed, single-use invitation contract and workspace membership rules.
- Optional events must evaluate the current preference before enqueue and immediately before provider I/O.
- Templates must render escaped names and trusted application URLs; client-provided redirect URLs, provider credentials, source snippets and payment data are prohibited.
- Anti-enumeration responses must not reveal whether an account or recipient exists.
- Provider response bodies and message content must not enter logs; only bounded error categories and provider event IDs may be retained.

## Delivery and failure states

1. Create the idempotent metadata record before provider handoff.
2. Claim with a bounded lease and increment the attempt count atomically.
3. Render and validate the approved template, then hand off to the selected provider.
4. Mark `delivered` only after the provider’s approved acknowledgement; a timeout becomes `delivery_unknown`/reviewable failure, never an automatic success.
5. Retry only approved transient categories with bounded backoff and a maximum attempt count. Permanent or exhausted failures enter a reviewable dead-letter state.
6. Replayed events return the existing delivery state and do not send a duplicate.

## Decisions required before implementation/integration

- provider, sending domain, DKIM/DMARC ownership and sandbox destination;
- Member 1 event names, transaction boundaries, retention and PostgreSQL policy behavior;
- approved template copy, localization, expiry wording and support fallback;
- required versus optional category list and preference semantics;
- provider acknowledgement, webhook/reconciliation, retry and dead-letter ownership;
- delivery-record retention and deletion/redaction policy;
- monitoring, alert thresholds and operator access without message content.

## Minimum acceptance evidence after approval

- provider-controlled sink receives password-reset, verification and invitation messages with correct expiry and no raw-token leakage;
- duplicate, replayed, reordered, timeout, retry and exhausted-delivery tests;
- anti-enumeration, cross-workspace recipient and revoked-membership tests;
- preference suppression for optional categories while required messages remain protected;
- redaction tests for logs, error categories and persisted delivery metadata;
- browser evidence for unavailable, loading, success, failure and recovery states.

Until these decisions and tests exist, NOT-01 and NOT-02 remain partial and the application must not represent provider delivery as live.
