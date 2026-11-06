# MY OWL V1 — Member 2 Contracts

This document records interfaces Member 2 needs from the backend. It does not grant production or provider authority.

## Member 1 coordination

- Member 1 commits `f4476bc` and `882b020` are accessible only in `C:\YC-my-owl-v1-member1` and are not integrated here.
- The reviewed local Member 1 contract requires merged pull requests to persist the exact merge SHA, deduplicated scan work, and immutable resolution evidence. Notification copy must not say “resolved” until that evidence is authoritative.
- Provider-backed billing, PostgreSQL tenant/RBAC verification, account deletion/retention, member revocation and approved email delivery remain external or incomplete dependencies.

## Frontend/backend boundaries

- Client controls are advisory. Every account, workspace, membership, billing and preference mutation must enforce the current session and workspace role server-side.
- Workspace-changing endpoints must derive tenant scope from membership and return safe generic denial/not-found responses; the client must not infer authorization from hidden controls.
- Billing UI may display canonical plan/entitlement projections and “coming soon” states, but must not grant access from redirects or client state. Provider-backed checkout, portal, invoice and plan-change acceptance stays blocked until the approved backend provider exists.
- Notification preferences are optional-message controls only. Security, account recovery and legally required messages cannot be silently suppressed.
- Draft legal, refund, status and incident content must show review/source status and must not claim approval, uptime or current incidents without authoritative evidence.

## Implemented local interfaces

- Account: `GET/PATCH /api/account` and `POST /api/account/password`; profile names are validated server-side, password changes require the current password, other sessions are invalidated, and OAuth-only accounts are explicitly blocked until local-password enrollment exists.
- Organization: `/api/workspace/settings`, `/api/workspace/members`, `/api/workspace/invitations`, `/api/workspace/invitations/accept`, and `/api/workspace/audit`; owner/member remains the complete local role model, invitation tokens are hashed/expiring/single-use, and member removal invalidates sessions.
- Notifications: `GET/PATCH /api/account/notifications`; preferences are server-owned, required security/account-recovery categories cannot be disabled, and unavailable email delivery is represented as unavailable rather than silently accepted.

## Proposed interfaces requiring review before shared backend changes

- Account: authenticated `GET/PATCH /api/account` plus password-change action with current-password/reauthentication semantics; OAuth-only accounts receive no unusable password control.
- Organization: workspace-scoped settings, members, invitations and audit queries with cursor pagination and explicit role capabilities.
- Notifications: server-owned preference categories/channels, immutable domain event IDs, recipient snapshot/authorization at delivery time, and delivery outcome states.
- Billing: canonical plans/subscription state, provider portal session, provider-backed invoices and idempotent change requests; no mock result may be labeled paid/live.

## Release-sensitive decisions

- Invitation creation currently returns a manual-copy link because no approved email provider is enabled. The token is not logged or persisted in plaintext.
- The local SQLite schema includes organization, notification-preference, and audit tables; PostgreSQL migration/RLS/role evidence remains unverified in this worktree.
- Public legal, refund, status, and contact pages intentionally identify draft/unavailable states. Owner/legal/status-provider review is required before those surfaces are presented as production policy or operational evidence.

## Change log

- 2026-11-07: Initial Member 2 contract inventory from the clean baseline and accessible Member 1 local contract evidence.
- 2026-11-07: Added local account, workspace administration, invitation, audit, notification-preference, billing-boundary, public-site and incident-response contracts; no Member 1 commit was integrated.
