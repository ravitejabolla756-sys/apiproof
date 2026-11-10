# MY OWL V1 — Member 2 → Member 1 Integration Handoff

Status: ready for Member 1 review; no shared backend behavior is integrated by this document.

Repository branch: `codex/v1-frontend-product`  
Member 2 HEAD at handoff: `809d4df`  
Member 1 reference reviewed read-only: `4138c9a8` (`codex/v1-backend-security`)  
Worktree: `/Users/sandstone/Documents/myowl/MY-OWL-V1`

## Current Member 2 state

- **4/26 DONE_VERIFIED_LOCAL:** AUTH-08, NOT-06, WEB-08 and WEB-14.
- **21 PARTIAL:** UI-12, UI-13, ORG-02, ORG-03, ORG-04, ORG-11, BILL-07, BILL-08, BILL-09, BILL-11, NOT-01, NOT-02, NOT-03, NOT-04, NOT-05, NOT-10, WEB-11, WEB-12, WEB-13, WEB-15 and SEC-18.
- **1 BLOCKED:** AUTH-09, pending the approved deletion/retention/legal contract.
- Local evidence: full production-bundle Playwright **239/239**, seeded Vitest **1,504 passed across 200 files**, repository lint/typecheck/build passed, and the 9-route loopback performance probe passed.
- The frontend intentionally remains fail-closed for `ORG_10_CONTRACT_PENDING`, `DELETION_CONTRACT_PENDING`, `PROVIDER_NOT_CONFIGURED` and `DIGEST_CONTRACT_PENDING`.

## Integration invariants

1. The server derives actor identity, workspace membership, role and tenant scope. Client role labels, hidden controls and workspace IDs are never authorization.
2. Removing a member must revoke only that workspace’s access. Preserve personal sessions, other-workspace memberships and unrelated sessions.
3. Final-owner protection must be enforced inside the transaction under concurrent requests.
4. Invitation tokens remain hashed, expiring, single-use and email-bound. Cancellation and resend rotation must invalidate prior tokens.
5. Authenticated product responses remain private and non-cacheable (`Cache-Control: private, no-store, max-age=0`).
6. No provider response, paid entitlement, invoice, digest schedule or legal policy may be fabricated to make a UI appear complete.
7. Applied migration IDs must never be renumbered, replayed or silently reused with a different name.

## Existing endpoint contracts to preserve

All authenticated endpoints must apply CSRF/origin protection where the existing route requires it, derive workspace scope server-side, return generic safe authorization errors, and retain private no-store headers.

| Area | Endpoint | Request | Successful response / current boundary |
|---|---|---|---|
| Account | `GET /api/account` | Auth cookie | `{ authenticated: true, user }`; unauthenticated is `401` with `UNAUTHORIZED`. |
| Account | `PATCH /api/account` | Validated profile fields | `{ user }`; server validates identity fields and workspace-independent account ownership. |
| Password | `POST /api/account/password` | Current password, new password, confirmation | Success response plus session policy; current local contract invalidates other sessions. Reauthentication and OAuth-only semantics require Member 1 review. |
| Auth | `POST /api/auth` | `action` of `login`, `signup`, `logout`, `request_password_reset` or `complete_password_reset`, with action-specific validated fields | Typed success/error responses, anti-enumeration reset behavior, CSRF/origin checks and active rate limits. AUTH-05 verification action/schema remains a Member 1 integration dependency. |
| Workspaces | `GET /api/workspaces` | Auth cookie | `{ workspaces, activeWorkspaceId }`; list and active workspace are membership-derived. |
| Workspace context | `POST /api/workspace/context` | `{ workspaceId }` | `{ workspace }` plus the `HttpOnly`, `SameSite=Lax` `apiproof_workspace_id` cookie; invalid membership is denied. |
| Workspace settings | `GET /api/workspace/settings` | Auth cookie / validated context | `{ workspace }`. |
| Workspace settings | `PATCH /api/workspace/settings` | `{ name, slug }` | `{ workspace }`; owner capability and server validation apply. |
| Members | `GET /api/workspace/members` | Auth cookie / validated context | `{ workspace, members }`. |
| Member role | `PATCH /api/workspace/members` | `{ workspaceId, userId, role: 'owner' \| 'member' }` | Updated `{ members }`; owner capability, role matrix and final-owner rules are server-owned. |
| Invitations | `GET /api/workspace/invitations` | Auth cookie / validated context | `{ invitations }`. |
| Invitations | `POST /api/workspace/invitations` | `{ email, role?: 'member' }` | `201` with `{ invitation, inviteToken, inviteUrl, delivery: 'manual-copy-only' }`; no approved email provider is currently enabled. |
| Invitation cancel | `DELETE /api/workspace/invitations` | `{ invitationId }` | `{ success: true }`; owner authorization and tenant scope are server-owned. |
| Invitation accept | `POST /api/workspace/invitations/accept` | `{ token }` | `{ workspace }`; token must remain hashed, expiring, single-use and email-bound. |
| Audit | `GET /api/workspace/audit?cursor=...` | Optional bounded cursor | Cursor page containing tenant-scoped audit events; taxonomy, redaction, retention and visibility require Member 1 review. |
| Notification preferences | `GET /api/account/notifications` | Auth cookie | `{ preferences }`. |
| Notification preferences | `PATCH /api/account/notifications` | `{ updates: [{ category, channel, enabled }] }` | `{ preferences }`; required security/account-recovery categories cannot be disabled. |
| Subscription | `GET /api/billing/subscription` | Auth cookie / validated context | `{ subscription, plan, metrics, availablePlans }`; canonical provider state must remain server-owned. |
| Checkout | `POST /api/billing/checkout` | `{ planId }` | Currently `403 BILLING_NOT_AVAILABLE` for paid plans. Future checkout URL requires approved provider, owner authorization, signed lifecycle and safe return URL. |
| Portal | `POST /api/billing/portal` | Auth cookie / validated context | Currently `403 BILLING_NOT_AVAILABLE`; future provider session and return URL contract is pending. |

## Required Member 1 contracts

### ORG-10 workspace member revocation

Member 1’s reviewed service accepts `{ workspaceId, userId, reason?, idempotencyKey }`, but the shared route boundary is not yet integrated. The final integration must:

- choose and document the route/method and exact error mapping;
- derive actor and subject membership inside the transaction;
- require owner/manage-members capability;
- lock the workspace membership set on PostgreSQL;
- protect the final owner under concurrent requests;
- deduplicate by `(workspaceId, idempotencyKey)` and reject conflicting reuse;
- persist `workspace.member_revocation.v1` audit evidence;
- revoke only workspace-scoped membership/session/email-verification/password-reset/OAuth state;
- preserve `personal_sessions` and `other_workspace_memberships`;
- recheck membership before queued jobs execute;
- return the reviewed completed result parsed by `workspace-member-revocation-contract.ts`.

The Member 2 removal UI remains disabled until this route and transaction are reviewed. The existing local broad session-invalidation endpoint must not be wired to the UI.

### Organization and audit

Member 1 must approve the ORG-05 role matrix, owner/member/invitation/audit capabilities, audit event taxonomy, redaction, cursor ordering, retention, PostgreSQL tenant isolation and concurrent role/final-owner tests. ORG-03 email acceptance/resend delivery also needs an approved provider and bounded retry policy.

### AUTH-05 and AUTH-09

Provide the exact verification action/schema, resend behavior, token expiry/replay rules and provider delivery evidence. For deletion, provide an approved endpoint and contract for authorization, reauthentication, explicit confirmation, repeated requests, partial failure, audit evidence, durable erasure, retention exceptions and legal sign-off. Member 2 will not invent a destructive endpoint.

### PR-08 / notification events

Member 1 currently persists finding-resolution evidence but does not publish a notification event. Before NOT-05 resolution alerts are implemented, approve a transaction-safe outbox boundary and immutable event fields: workspace, repository, finding, migration, pull request, merge SHA, scan ID, classification, evidence identity and event ID. Duplicate/reordered events must be idempotent, and copy must not call a finding resolved without authoritative exact-commit evidence.

## PostgreSQL/RBAC evidence required

- Run organization, membership, invitation, audit, billing and notification suites against PostgreSQL, not only SQLite.
- Prove workspace tenant predicates and RLS/role grants for every read and mutation path.
- Prove owner/manage-members capability and final-owner protection under concurrent requests.
- Prove revocation preserves personal sessions and memberships in unrelated workspaces.
- Prove audit visibility, redaction and retention boundaries.
- Record migration application history as `(id, name)` before any integration migration runs.
- Capture rollback/restore evidence and isolation results in staging with no production data exposure.

## Migration 024–027 reconciliation

The branches collide by ID and name:

| ID | Member 2 | Member 1 |
|---|---|---|
| `024` | `workspace_invitations_and_audit_events` | `email_verification_tokens_and_user_state` |
| `025` | `user_notification_preferences` | `audited_finding_lifecycle` |
| `026` | `email_delivery_ledger` | `finding_resolution_verification_evidence` |
| `027` | `slack_scan_failure_deliveries` | `durable_workspace_member_revocation` |

Required decision: inventory the target database’s applied `(id,name)` rows and table/schema presence; preserve every applied ID; agree on a globally unique namespace for unapplied work; add an explicit compatibility/upgrade migration or deploy-time reconciliation reviewed by both members; reject same-ID/different-name states. Do not renumber or replay an applied migration.

## Billing and invoice contract

Before BILL-07/08/09 activation, approve provider, canonical plan/subscription/entitlement state, billing-owner capability, webhook signature/idempotency, portal session, invoice projection schema, authorized download/deep-link lifetime and allowlist, retention/audit policy, taxes/cancellation/proration behavior and sandbox fixtures. The current UI remains beta-unavailable and does not fabricate invoices or URLs.

Required evidence: provider sandbox checkout/portal/invoice tests, unauthorized and cross-workspace tests, webhook replay/reordering tests, owner-only tests, URL safety tests, retention review and legal approval. Live payments remain disabled.

## Notification and digest contracts

For NOT-01 through NOT-05, approve provider/domain, event IDs, recipient snapshot and authorization, preference enforcement at enqueue and send, template/version, retry/DLQ/lease policy, deduplication, redacted errors, retention and provider-controlled delivery evidence. Required security/account-recovery messages cannot be silently suppressed.

For NOT-10, approve cadence, event/read model, aggregation, recipient preferences, timezone behavior, scheduler owner/lease, queueing, template, opt-out, retention and deduplication. Do not add a recurring scheduler or enable the disabled controls before approval.

## Public, legal and operations approvals

- WEB-11/12: approved privacy/terms/refund copy, effective/version dates and behavior-aligned billing/retention language.
- WEB-13: approved monitoring source, component catalog, freshness/timeout mapping, incident wording and rehearsal.
- WEB-15/UI-12/UI-13: hosted CI, integrated staging, Lighthouse/Core Web Vitals where required, manual assistive-technology review and issue triage.
- SEC-18: named non-secret owners, approved alert route, provider/database response procedure and timestamped tabletop with owner/security sign-off.

## Required integration sequence

1. Member 1 and Member 2 agree on migration reconciliation using the target database history.
2. Integrate and test the ORG-10 route/transaction, including PostgreSQL concurrency and session-preservation evidence.
3. Integrate AUTH-05 and approved deletion/retention contracts.
4. Approve provider contracts and integrate billing/invoice and notification/digest paths behind their existing typed adapters.
5. Run the full PostgreSQL, provider-sandbox, hosted CI and staging matrix; attach artifacts to the release gates.
6. Only after all evidence is reviewed may the fail-closed UI boundaries be changed.

No push, merge, deployment, production resource change or payment activation is authorized by this handoff.
