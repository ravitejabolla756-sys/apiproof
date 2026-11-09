# MY OWL V1 — Member 2 Contracts

This document records interfaces Member 2 needs from the backend. It does not grant production or provider authority.

## Member 1 coordination

- Member 1 commits `f4476bc` and `882b020` are accessible only in `C:\YC-my-owl-v1-member1` and are not integrated here.
- The reviewed local Member 1 contract requires merged pull requests to persist the exact merge SHA, deduplicated scan work, and immutable resolution evidence. Notification copy must not say “resolved” until that evidence is authoritative.
- Provider-backed billing, PostgreSQL tenant/RBAC verification, account deletion/retention, member revocation and approved email delivery remain external or incomplete dependencies.

## Frontend/backend boundaries

- Client controls are advisory. Every account, workspace, membership, billing and preference mutation must enforce the current session and workspace role server-side.
- Workspace-changing endpoints must derive tenant scope from membership and return safe generic denial/not-found responses; the client must not infer authorization from hidden controls.
- Workspace context is server-authoritative: `POST /api/workspace/context` validates membership before setting the `HttpOnly`, `SameSite=Lax` `apiproof_workspace_id` cookie; `GET /api/workspaces` returns the authorized list and active ID. Explicit `workspaceId` query parameters remain supported for deep links and are membership-checked. Invalid or revoked cookies fall back to the authorized default workspace, never to an arbitrary tenant. Client role/visibility state is not trusted.
- Billing UI may display canonical plan/entitlement projections and “coming soon” states, but must not grant access from redirects or client state. Provider-backed checkout, portal, invoice and plan-change acceptance stays blocked until the approved backend provider exists.
- Notification preferences are optional-message controls only. Security, account recovery and legally required messages cannot be silently suppressed.
- Draft legal, refund, status and incident content must show review/source status and must not claim approval, uptime or current incidents without authoritative evidence.
- Response privacy: authenticated workspace/account/billing/repository/provider-rule/integration responses and shared validation, CSRF, rate-limit, operational and webhook outcomes must be explicitly non-cacheable. Product API responses use `Cache-Control: private, no-store, max-age=0`; public health, internal cron/status and webhook responses use `Cache-Control: no-store`. This is an HTTP privacy invariant, not a substitute for authorization, tenancy checks or provider signature validation.

## Implemented local interfaces

- Account: `GET/PATCH /api/account` and `POST /api/account/password`; profile names are validated server-side, password changes require the current password, other sessions are invalidated, and OAuth-only accounts are explicitly blocked until local-password enrollment exists.
- Email verification UI: `/verify-email` consumes the reviewed AUTH-05 `POST /api/auth` action `{ action: 'verify_email', token }`, reads the token only from the URL fragment, removes it from browser history after success, and exposes safe missing/invalid/success states. The backend action, resend action, template approval and provider delivery remain Member 1/integration dependencies.
- Organization: `/api/workspace/settings`, `/api/workspace/members`, `/api/workspace/invitations`, `/api/workspace/invitations/accept`, and `/api/workspace/audit`; owner/member remains the complete local role model, invitation tokens are hashed/expiring/single-use, member removal invalidates sessions, and audit events use a stable `(created_at,id)` cursor with bounded pages. Member mutations send the explicit `{ workspaceId, userId, role? }` contract required by Member 1; the server still derives authorization from the authenticated session and membership.
- Workspace context: `GET /api/workspaces` and `POST /api/workspace/context`, with selected workspace propagation across dashboard overview, repository/GitHub, billing, Slack, provider-rule, activity, finding, migration and pull-request APIs. Resource-specific routes continue to authorize through their repository/finding/migration membership checks.
- Notifications: `GET/PATCH /api/account/notifications`; preferences are server-owned, required security/account-recovery categories cannot be disabled, and unavailable email delivery is represented as unavailable rather than silently accepted.
- Invoice history UI: workspace settings exposes a truthful beta-unavailable state only. No invoice schema, provider deep link, download URL, paid entitlement or billing-provider call exists in the frontend until Member 1's provider-backed invoice projection and legal retention policy are approved.
- Browser CI runtime: the browser workflow builds the web package and serves that production build through `apps/web/scripts/playwright-server.ts` with an explicit `APIPROOF_E2E_TEST_MODE=true`, CI-only SQLite path and workflow test secret. Runtime classification fails closed when CI, the explicit database path or provider URL conditions are not satisfied; the production database guard and real rate limiter remain active. Each browser test uses a distinct documentation-only test client IP so repeated seeded-user journeys do not exhaust one shared runner address.

## Proposed interfaces requiring review before shared backend changes

- Account: authenticated `GET/PATCH /api/account` plus password-change action with current-password/reauthentication semantics; OAuth-only accounts receive no unusable password control.
- Organization: workspace-scoped settings, members, invitations and audit queries with cursor pagination and explicit role capabilities.
- Notifications: server-owned preference categories/channels, immutable domain event IDs, recipient snapshot/authorization at delivery time, and delivery outcome states. Optional-channel workers must evaluate the current preference both before enqueue and immediately before external delivery. The local transactional adapter accepts `EMAIL_FROM` (with `PASSWORD_RESET_FROM` compatibility fallback), requires a trusted app URL, and supports `EMAIL_DELIVERY_MODE=smtp` or a non-production-only `sink`; the sink never reaches production. Migration `026` adds a metadata-only `email_deliveries` ledger with event-key deduplication, template/version identifiers, delivery status, bounded attempts, leases and redacted error categories; it never stores message bodies or raw tokens. Migration `027` adds a metadata-only `slack_scan_failure_deliveries` outbox keyed by `(workspace, scan request, event kind)`; only terminal scan state creates an event, the worker revalidates active connection/membership/repository access and `scan_failure/slack` immediately before sending, and Slack content is limited to repository name, safe failure category and a trusted dashboard URL. The existing Slack proposal outbox now also accepts direct migration/PR lifecycle events keyed by proposal or PR state, with `migration/slack` preference checks and canonical GitHub links; merged wording explicitly says verification is pending and never claims resolution. Member 1's current PR-08 scan worker persists `finding_resolution_verifications` and finding lifecycle events inside its transaction but does not yet publish a notification event. Before adding resolution alerts, Member 1 and Member 2 must approve a transaction-safe outbox/event boundary and exact fields: workspace, repository, finding, migration, pull request, merge SHA, scan ID, classification, immutable evidence identity and event ID. The event key must include the exact scan/evidence identity; classifications remain `resolved`, `unresolved`, `regressed`, `ambiguous` or `inconclusive`, and no Slack copy may claim verified resolution without the persisted exact-commit evidence. Member 1 must also review event naming, template wording, retention and PostgreSQL policy/runtime behavior before shared integration.
- Billing: canonical plans/subscription state, provider portal session, provider-backed invoices and idempotent change requests; no mock result may be labeled paid/live.

## Pending cross-member review matrix

These are the handoff decisions required before Member 2 integrates shared backend behavior. The current branch intentionally implements only truthful unavailable/beta boundaries for these rows.

### Member 1 branch comparison — migration namespace collision

The remote `codex/v1-backend-security` at `4138c9a8ef42725769971332d8a4e168ea1b5c0e` was fetched read-only on 2026-11-09 for contract comparison. It uses migration IDs `024` (`email_verification_tokens_and_user_state`), `025` (`audited_finding_lifecycle`), `026` (`finding_resolution_verification_evidence`) and `027` (`durable_workspace_member_revocation`). This branch uses the same IDs for `workspace_invitations_and_audit_events`, `user_notification_preferences`, `email_delivery_ledger` and `slack_scan_failure_deliveries`, respectively. Because `_apiproof_migrations.id` is the primary key and the migrator skips an already-applied ID without checking its name, these are hard cross-branch collisions, not merge-order differences. Member 1 and Member 2 must agree on a single globally unique migration namespace and a source-grounded upgrade/rollback path before either branch is integrated.

Member 1's revocation service defines the pending ORG-04/SEC-19 handoff: owner-capability authorization inside a transaction; workspace-scoped membership/session/email-verification/password-reset/OAuth invalidation; preservation of personal sessions and other-workspace memberships; idempotency keyed by `(workspace, idempotencyKey)`; last-owner protection; and durable `workspace.member_revocation.v1` evidence. The current Member 2 removal path must not be integrated against that service until its endpoint, transaction, migration and audit-event boundaries are reviewed together.

| Area | Member 1 / owner decision required | Current local boundary | Do not activate until |
|---|---|---|---|
| `BILL-09` invoice history | Provider invoice projection, billing-owner capability, URL lifetime/allowlist, retention and audit taxonomy | Settings shows an axe-clean unavailable state with no invoice action | Provider sandbox fixtures, authorization/retention tests and legal approval |
| `NOT-10` digest notifications | Cadence/timezone, event categories, recipient preference, scheduler lease, retention, template and provider | Weekly digest email and Slack controls remain disabled/unavailable | Approved event contract, deterministic scheduler tests and provider sink |
| `BILL-11` enterprise intake | Destination, data controller, privacy notice, retention, spam/rate limit and delivery owner | Enterprise form remains explicitly non-sending | Approved destination acknowledgement, redaction/retention tests and owner sign-off |
| `WEB-13` status communications | Approved source ID, component catalog, freshness policy, incident wording and escalation owner | Public page states that no live monitor is connected | Authenticated source, stale/timeout mapping tests and incident drill |
| `NOT-01/02/03/04/05` delivery | Event identity, recipient authorization, template/version, retry/DLQ, retention and provider/domain | Local sink/outbox behavior remains non-production and provider-neutral | Member 1 event review, provider-controlled delivery and secret/redaction tests |
| `AUTH-09` / `ORG-04` | Deletion/retention and member-revocation contracts, including PostgreSQL behavior | No destructive deletion flow is fabricated; local removal path remains contract-bound | Legal retention approval, reviewed revocation service and PostgreSQL proof |

Review outcome must be recorded in this matrix and the relevant task documents before a shared implementation is merged. A local browser or SQLite pass does not satisfy provider, PostgreSQL, legal or production approval.

## Release-sensitive decisions

- Invitation creation currently returns a manual-copy link because no approved email provider is enabled. The token is not logged or persisted in plaintext.
- The local SQLite schema includes organization, notification-preference, and audit tables; PostgreSQL migration/RLS/role evidence remains unverified in this worktree.
- Public legal, refund, status, and contact pages intentionally identify draft/unavailable states. Owner/legal/status-provider review is required before those surfaces are presented as production policy or operational evidence.

## Change log

- 2026-11-07: Initial Member 2 contract inventory from the clean baseline and accessible Member 1 local contract evidence.
- 2026-11-07: Added local account, workspace administration, invitation, audit, notification-preference, billing-boundary, public-site and incident-response contracts; no Member 1 commit was integrated.
- 2026-11-07: Added the provider-neutral transactional email adapter and metadata-only delivery ledger; Member 1 must review event/template names, retention, PostgreSQL policy behavior and worker integration before shared integration.
- 2026-11-07: Slack finding deliveries now re-check the current `findings/slack` preference before enqueue and before provider I/O; opt-out suppression is covered locally without sending external messages.
- 2026-11-07: Terminal scan failures now have a local Slack outbox/worker slice with idempotency, bounded retry and safe-content tests; no external Slack delivery or production migration was performed.
- 2026-11-07: Migration/PR Slack notifications now cover direct proposal outcomes and authoritative PR state webhooks with state-key dedupe, preference enforcement and non-resolution wording for merges; PR-08 post-merge resolution events remain an explicit integration dependency.
- 2026-11-07: Added server-validated workspace context selection with stale-cookie fallback, selected-scope API propagation, accessible picker coverage and no production/provider side effects; Member 1 review and PostgreSQL tenant/RLS evidence remain pending.
- 2026-11-07: Added the AUTH-05-compatible verification-link UI and missing-token browser coverage; no verification token, resend backend, email provider or production delivery behavior was fabricated.
- 2026-11-07: Aligned member role/removal requests with Member 1's explicit workspace/user contract; legacy opaque membership IDs are no longer sent by the frontend, and no authorization decision trusts client role labels.
- 2026-11-07: Audited Member 1's PR-08 scan-worker boundary; it currently persists exact-commit resolution evidence but emits no notification event. Resolution alerts remain intentionally unimplemented pending a reviewed transaction-safe outbox contract.
- 2026-11-07: Hardened the browser CI path with a production-build test server, explicit fail-closed E2E runtime classification, environment-overridable fixture database path, and distinct test-client IPs; local CI-mode browser evidence is 22/22 without disabling production authorization or rate limiting.
- 2026-11-08: Added the settings-page invoice-history beta boundary and focused browser assertion; provider-backed invoice data remains intentionally unimplemented pending the shared billing contract.
- 2026-11-08: Established and verified the response privacy invariant across authenticated product APIs, shared validation/rate-limit helpers, operational routes and billing/GitHub webhooks; local route suites and the full seeded/browser regressions pass, while hosted/staging/production verification remains open.
- 2026-11-08: Added a cross-member review matrix for invoice, digest, enterprise-intake, status, delivery and deletion/revocation contracts; no shared backend, provider, production or remote Git operation was performed.
- 2026-11-09: Read-only comparison with Member 1's backed-up branch identified hard migration-ID collisions at `024–027` and recorded the revocation-service handoff; no migration was renumbered and no branch was merged.
