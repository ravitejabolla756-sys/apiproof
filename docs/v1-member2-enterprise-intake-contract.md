# MY OWL V1 — Enterprise inquiry intake contract proposal

Status: proposal for owner, privacy/legal and operations review. This document does not connect the contact form to email, CRM, Slack, a webhook, or any external destination.

## Current safety boundary

The public contact form may validate fields and explain its state, but it must not imply that an inquiry was delivered while no approved destination exists. The current beta wording is therefore correct: no message is sent and sensitive details should go through an owner-provided support channel.

## Destination decision required

The owner must select exactly one approved intake destination and identify its data controller/processor, retention period and access group before activation:

- an owner-controlled mailbox with an approved transactional or support provider;
- an owner-controlled CRM/helpdesk form with a reviewed privacy notice;
- a reviewed enterprise intake service with a server-side webhook and durable delivery record;
- an explicit deferral of enterprise self-service, leaving the current non-sending form in place.

The destination must not be selected from client input, a query parameter or an unreviewed environment variable. Secrets and destination credentials stay outside source control.

## Proposed submission contract

If an approved destination is selected, the server—not the browser—should own submission and return only bounded states:

```text
POST /api/contact/inquiries

request: { name, workEmail, inquiryType, message, honeypot? }
response: { state: "accepted" | "unavailable" | "retryable_failure" }
```

Required behavior:

- validate and normalize name, email, allowlisted inquiry type and bounded message length server-side;
- reject honeypot/spam/rate-limit failures without revealing whether a destination account exists;
- include a privacy notice and do not request repository source, credentials, tokens, payment data or secrets;
- assign a durable inquiry ID and idempotency key before external handoff;
- persist metadata-only delivery state and redacted error categories, never raw message content in logs;
- retry only bounded transient failures; represent uncertain handoff separately from confirmed acceptance;
- expose “accepted” only when the approved destination acknowledges the handoff, not when the client clicks submit;
- provide a safe support fallback when the destination is unavailable.

## Required approval decisions

- approved destination, owner and access list;
- privacy notice, lawful basis/consent language and retention/deletion process;
- allowed inquiry categories and sensitive-content warning;
- spam protection, rate limit and abuse-escalation policy;
- delivery provider, sender identity, webhook authentication and retry/DLQ ownership;
- whether attachments, enterprise pricing data or customer repository identifiers are prohibited;
- response copy and any promised response window (no SLA should be implied without approval).

## Minimum acceptance evidence after approval

- server-side validation, anti-spam, rate-limit and idempotency tests;
- no-destination, accepted, transient-failure, uncertain-handoff and retry browser states;
- redaction tests proving credentials, tokens, source snippets and payment data never enter logs;
- authorized recipient and cross-tenant isolation tests if the destination is tenant-aware;
- provider-controlled sink/CRM evidence and retention/deletion verification;
- accessible keyboard, mobile, error and success-state coverage.

Until these decisions and tests exist, BILL-11 remains partial and the public form must remain explicitly non-sending.

The current frontend represents that boundary as `enterpriseIntakeAvailability` with code `NO_APPROVED_DESTINATION`; it is a local unavailable projection only and does not authorize a client-side destination or delivery attempt.
