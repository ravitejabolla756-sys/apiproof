# MY OWL V1 — Incident Response Runbook

Status: implementation draft for owner/security review. This document is an operational contract, not evidence that production monitoring or an on-call rotation exists.

## Scope and operating assumptions

This runbook covers account compromise, workspace authorization failures, repository-data exposure, billing integrity, notification delivery, GitHub/Slack integration, and public-site incidents. The beta remains read-only at the repository boundary; no response step authorizes direct repository writes, payment activation, email activation, deployment, or database changes without the service owner’s approval.

The current repository does not prove a staffed on-call rotation, approved status provider, production alert routing, transactional email provider, or production PostgreSQL role configuration. Escalate to the service owner when any of those are required.

## Severity and ownership

| Severity | Example | Initial owner | Customer-facing posture |
|---|---|---|---|
| SEV-0 | Confirmed cross-workspace data exposure, credential compromise, or unsafe repository write | Incident commander + security owner | Pause affected capability; publish only verified facts through an approved channel |
| SEV-1 | Authentication outage, tenant authorization regression, billing integrity issue, or broad scan corruption | Incident commander + engineering owner | State impact and workaround after evidence review |
| SEV-2 | One workspace integration, notification queue, or public route materially degraded | Service owner + feature owner | Record affected surface and next update source; do not invent an ETA |
| SEV-3 | Cosmetic, documentation, or isolated non-sensitive defect | Feature owner | Track through normal engineering workflow |

Assign one incident commander, one technical lead, and one communications owner. If those people are not available, the service owner must explicitly accept the risk before continuing a production operation.

### Severity decision sequence

Classify from the highest applicable condition and record the evidence for the decision:

1. **SEV-0** if there is confirmed cross-workspace exposure, credential compromise, or an unsafe repository write. Pause the affected capability and escalate immediately to the security owner and service owner.
2. **SEV-1** if the issue is an authentication outage, tenant-authorization regression, billing-integrity issue, broad scan corruption, or a required account/security notification failure without confirmed SEV-0 impact.
3. **SEV-2** if the impact is limited to one workspace integration, notification queue, or public route and no higher-severity condition applies.
4. **SEV-3** for a cosmetic, documentation, or isolated non-sensitive defect.

When scope or data impact is unknown, use the higher plausible severity until the investigation establishes a lower one. A later downgrade must record the evidence and decision-maker; a green deploy, queue depth, or client-side state is not sufficient evidence.

### Operational readiness prerequisites

Before enabling a live integration or treating this runbook as an operational control, the service owner and security owner must record the following. `NOT_AVAILABLE` is an honest state, not a substitute for approval.

| Prerequisite | Required evidence | Current repository state |
|---|---|---|
| Incident commander, technical lead and communications owner | Named owners and escalation channel | `NOT_AVAILABLE — owner review required` |
| Detection and alert routing | Approved monitor, alert rule, notification path and test timestamp | `NOT_AVAILABLE — monitoring approval required` |
| Status communication source | Approved status provider or owner-controlled publishing procedure | `NOT_AVAILABLE — status-source approval required` |
| Provider and credential response | Approved rotation/suspension procedure without secrets in the record | `NOT_AVAILABLE — provider access required` |
| Database and tenant-isolation response | Reviewed PostgreSQL roles/RLS evidence and restore/rollback procedure | `NOT_AVAILABLE — staging/Member 1 evidence required` |
| Tabletop exercise | Timestamped redacted exercise record with gaps, owners and sign-off | `NOT_RUN — tabletop required` |

## First 15 minutes

1. Open an incident record with UTC timestamps, reporter, affected surface, suspected severity, and a no-secrets evidence location.
2. Preserve request IDs, authenticated user/workspace IDs, deployment version, relevant webhook/delivery IDs, and redacted error categories. Never copy passwords, session cookies, OAuth codes, Slack tokens, billing signatures, or repository source into the record.
3. Confirm whether the issue is reproducible in an isolated test database or staging environment. Do not use production data for debugging unless the incident commander and security owner approve the minimum necessary query.
4. Contain the narrowest capability: revoke a compromised session/integration, disable a failing worker, block a route, or pause a provider callback. Record the exact containment action and rollback condition.
5. Determine whether the incident crosses a tenant boundary, changes billing entitlement, or suppresses a required account/security notification. Those conditions are at least SEV-1.
6. Escalate to the service owner for any external communication, credential rotation, provider suspension, database change, or deployment.

## Investigation guides

### Authentication and account compromise

- Validate the session row, expiry, user identity, password-reset token state, OAuth provider identity, and recent account audit events.
- Invalidate all sessions for the affected user when compromise is plausible; preserve only the current session when the user intentionally changes their password through the authenticated account flow.
- Revoke affected OAuth/Slack connections and rotate provider credentials through the approved provider console. Never place replacement secrets in source, logs, or chat.
- Check for workspace membership changes, invitation acceptance, role changes, and repository reads after the earliest credible compromise timestamp.

### Tenant authorization or data exposure

- Reproduce with two isolated users and workspaces using the same endpoint and resource identifiers.
- Verify server-side membership/owner checks and the database query predicate; hidden UI state is not evidence of authorization.
- Preserve the smallest redacted request/response pair proving the boundary. Do not broaden queries to “see what else is exposed.”
- If exposure is confirmed, stop the affected endpoint or integration, identify all potentially affected workspaces, and begin the approved notification/legal review.

### Billing and entitlement integrity

- Treat provider webhooks, subscription state, and usage counters as separate evidence sources. A redirect or client-side state is never proof of payment.
- During the beta, paid checkout and customer portal are intentionally unavailable. Any simulated URL is a defect and must be blocked before customer use.
- Preserve provider event IDs and signature-verification results without storing payment data. Reconcile idempotently after the provider owner approves access.

### Notification failure

- Determine whether the message is security/account-recovery (required) or optional product notification.
- Inspect the durable event/delivery record, recipient authorization at enqueue time, retry state, provider response category, and deduplication key.
- Do not claim delivery from queue insertion. If email is not configured, communicate that the message was not sent and use the approved manual channel.

## Recovery and closure

Before closing, the technical lead records: root cause, affected scope, containment, corrective change, regression test, remaining uncertainty, and evidence links. The incident commander verifies that the original reproduction no longer succeeds, authorization tests cover both sides of the boundary, and monitoring/alert ownership exists for the repaired path. The communications owner publishes a factual summary only after owner/security review.

### Closure evidence checklist

Do not close an incident from a green deploy or an empty queue alone. The incident record must link, or explicitly mark unavailable, each of these bounded artifacts:

- a UTC timeline containing detection, severity changes, containment, recovery and closure decisions;
- the affected capability, tenant scope and data classification, with identifiers redacted or access-controlled;
- the exact containment action, approver, rollback condition and confirmation that unrelated capabilities remained enabled;
- a redacted reproduction or a documented reason reproduction was unsafe or impossible;
- the regression test, configuration check or manual verification that disproves the original failure;
- provider, webhook, delivery or deployment identifiers needed for reconciliation, without secrets or payment data;
- customer, regulator or status-page communication decisions, including who approved any external wording;
- unresolved uncertainty, follow-up owner and due date, with a separate owner decision for any accepted risk.

If an artifact is unavailable because the repository has no approved monitoring, provider, staging or production access, record `NOT_AVAILABLE — approval or external evidence required`; never replace it with a local fixture result. A closure review is incomplete until the service owner and security owner accept that limitation.

### Escalation handoff record

For every SEV-0 or SEV-1, the incident commander should make the handoff explicit in the incident record:

| Handoff field | Required record |
|---|---|
| UTC handoff time | Timestamp and outgoing/incoming owner |
| Current severity | Severity and evidence supporting it |
| Containment state | Active control, rollback condition and next check |
| Customer impact | Affected tenants/capabilities, or `not yet known` |
| Next decision | The decision needed, approver and deadline |
| Communication state | Drafted, approved, sent, or deliberately withheld with rationale |

The handoff table is a record format, not evidence that an on-call rotation or alert channel currently exists.

## Tabletop exercise

Run this scenario before enabling live integrations: “A member accepts an invitation from a different account, then sees another workspace’s repository activity.” The expected response is to reproduce with two users, verify email-bound single-use token behavior, inspect membership predicates, revoke the affected member sessions, preserve redacted evidence, and keep the public status page explicitly unclaimed until an approved source is connected. Record gaps; do not mark the exercise as a production control.

### Tabletop record template — not yet conducted

Complete this record with the service owner and Member 1 before treating SEC-18 as reviewed. Use a fresh UTC timestamp and link only to redacted, non-production evidence.

| Field | Record |
|---|---|
| Exercise date / facilitator | `TBD` |
| Participants and assigned roles | `TBD` — incident commander, technical lead, communications owner, security owner |
| Detection signal and timestamp | `TBD` |
| First severity and rationale | `TBD` |
| Two-user/two-workspace reproduction result | `TBD` |
| Containment decision and rollback condition | `TBD` |
| Session/invitation/audit evidence reviewed | `TBD` — redacted references only |
| Customer/status communication decision | `TBD` — no publication without owner/security review |
| Gaps, owners, and due dates | `TBD` |
| Owner/security sign-off | `TBD` |

The worksheet is planning evidence only. Until it is completed and reviewed, the incident-response gate remains PARTIAL/BLOCKED for live operations.
