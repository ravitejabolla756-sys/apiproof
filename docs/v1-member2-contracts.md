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

## Implemented local interfaces

- Account: `GET/PATCH /api/account` and `POST /api/account/password`; profile names are validated server-side, password changes require the current password, other sessions are invalidated, and OAuth-only accounts are explicitly blocked until local-password enrollment exists.
- Email verification UI: `/verify-email` consumes the reviewed AUTH-05 `POST /api/auth` action `{ action: 'verify_email', token }`, reads the token only from the URL fragment, removes it from browser history after success, and exposes safe missing/invalid/success states. The backend action, resend action, template approval and provider delivery remain Member 1/integration dependencies.
- Organization: `/api/workspace/settings`, `/api/workspace/members`, `/api/workspace/invitations`, `/api/workspace/invitations/accept`, and `/api/workspace/audit`; owner/member remains the complete local role model, invitation tokens are hashed/expiring/single-use, member removal invalidates sessions, and audit events use a stable `(created_at,id)` cursor with bounded pages.
- Workspace context: `GET /api/workspaces` and `POST /api/workspace/context`, with selected workspace propagation across dashboard overview, repository/GitHub, billing, Slack, provider-rule, activity, finding, migration and pull-request APIs. Resource-specific routes continue to authorize through their repository/finding/migration membership checks.
- Notifications: `GET/PATCH /api/account/notifications`; preferences are server-owned, required security/account-recovery categories cannot be disabled, and unavailable email delivery is represented as unavailable rather than silently accepted.

## Proposed interfaces requiring review before shared backend changes

- Account: authenticated `GET/PATCH /api/account` plus password-change action with current-password/reauthentication semantics; OAuth-only accounts receive no unusable password control.
- Organization: workspace-scoped settings, members, invitations and audit queries with cursor pagination and explicit role capabilities.
- Notifications: server-owned preference categories/channels, immutable domain event IDs, recipient snapshot/authorization at delivery time, and delivery outcome states. Optional-channel workers must evaluate the current preference both before enqueue and immediately before external delivery. The local transactional adapter accepts `EMAIL_FROM` (with `PASSWORD_RESET_FROM` compatibility fallback), requires a trusted app URL, and supports `EMAIL_DELIVERY_MODE=smtp` or a non-production-only `sink`; the sink never reaches production. Migration `026` adds a metadata-only `email_deliveries` ledger with event-key deduplication, template/version identifiers, delivery status, bounded attempts, leases and redacted error categories; it never stores message bodies or raw tokens. Migration `027` adds a metadata-only `slack_scan_failure_deliveries` outbox keyed by `(workspace, scan request, event kind)`; only terminal scan state creates an event, the worker revalidates active connection/membership/repository access and `scan_failure/slack` immediately before sending, and Slack content is limited to repository name, safe failure category and a trusted dashboard URL. The existing Slack proposal outbox now also accepts direct migration/PR lifecycle events keyed by proposal or PR state, with `migration/slack` preference checks and canonical GitHub links; merged wording explicitly says verification is pending and never claims resolution. Member 1's PR-08 merge-SHA/rescan/resolution events are not integrated, so verified-resolved/unresolved/regressed notifications remain pending review. Member 1 must review event naming, template wording, retention and PostgreSQL policy/runtime behavior before shared integration.
- Billing: canonical plans/subscription state, provider portal session, provider-backed invoices and idempotent change requests; no mock result may be labeled paid/live.

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
