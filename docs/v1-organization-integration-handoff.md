# MY OWL V1 Organization Integration Handoff

## Current source behavior

Member 1 exports `buildMemberRevocationPlan(request, context)` and `revokeWorkspaceMember(actorUserId, request)`. The implementation is workspace-scoped, checks current membership and owner count, supports idempotency, writes `workspace.member_revocation.v1`, preserves personal sessions and unrelated memberships, and requires queued jobs to recheck membership.

Member 2 exports `removeOrganizationMember(userId, workspaceId, targetUserId)`, `acceptWorkspaceInvitation`, `revokeWorkspaceInvitation`, and organization audit helpers. Its DELETE route accepts `{ workspaceId, userId }` and returns `{ success: true }`.

## Required integration changes

1. Replace Member 2's removal implementation with the Member 1 revocation boundary.
2. Remove the global `DELETE FROM sessions WHERE user_id = ?` behavior. It incorrectly revokes unrelated workspace and personal sessions.
3. Load the target email from the database and invalidate unaccepted invitations in the same transaction as membership removal.
4. Preserve Member 2's `{ success: true }` response and optionally add verified revocation metadata.
5. Map final-owner, capability, access, self-revocation, and idempotency conflicts to the approved error codes.
6. Project the authoritative security event to Member 2's `member.removed` audit action without storing tokens or credentials.
7. Keep invitation acceptance conditional on both `accepted_at IS NULL` and `revoked_at IS NULL`.
8. Revalidate membership inside privileged queued workers.

## Contract status

The Member 1 revocation service, workspace policy, and durable revocation migration definition are now integrated into this worktree. The typed API contract remains a proposal until Member 2 approves it. Invitation invalidation, queued-job revalidation, stale-context route coverage, and PostgreSQL concurrency remain pending because Member 2's organization service and migration registry are not integrated.

The integrated migration definition still uses Member 1's source ID `027`. It must not be combined with Member 2's conflicting `027` until the approved migration-history decision is complete.

Phase 8B is currently blocked from route activation because Member 2's organization tables are supplied by conflicting migration `024`. The exact blocker and safe sequence are recorded in `docs/v1-organization-invitation-integration-blocker.md`.

## Safe integration sequence

1. Approve the shared request, response, error, event and audit contracts.
2. Integrate Member 1 revocation service and migration dependencies in an isolated merge commit.
3. Adapt Member 2 organization routes/services to call the revocation boundary.
4. Add invitation invalidation and audit projection inside the same transaction.
5. Run the organization, authorization, session, invitation-race, worker, typecheck, lint and browser contract matrix.

No migration IDs, databases, source branches, production resources, payment providers or external services were changed by this handoff.

## Phase 9 schema-independent integrations

The integration branch now includes Member 2's pure response contracts for billing checkout, billing portal, billing summaries, authentication responses, notification preferences, and digest availability. These contracts are schema-independent and explicitly keep unavailable billing/digest capabilities fail-closed. No billing provider, invoice history, notification migration, scheduled job, or external delivery service was activated.

Organization and invitation routes remain blocked by the unresolved `024` schema identity collision. Member 2's invoice-history contract was not copied because it depends on a date-display module that is part of the broader frontend integration and has not been reviewed in this branch.

## Phase 9B invoice and API compatibility

The reviewed schema-independent invoice slice is now integrated:

- `apps/web/src/lib/date-display-contract.ts`
- `apps/web/src/lib/invoice-history-contract.ts`
- `tests/invoice-history-contract.test.ts`

It validates server-owned invoice projections, rejects malformed dates and amounts, permits only credential-free HTTPS hosted URLs, and returns an explicit provider-unavailable state. It does not fabricate invoices, activate a provider, or create a route. The backend billing routes remain the authoritative source for subscription state; invoice history remains disconnected until an approved provider-backed adapter exists.

Notification and billing contract tests exercise parser/availability boundaries only. They do not establish workspace authorization, provider lifecycle, payment success, email delivery, digest scheduling, or end-to-end browser behavior.

## Phase 9C invoice API boundary

The integration branch now exposes `GET /api/billing/invoices`. It derives the authenticated user from the session, resolves the requested workspace through `requireWorkspaceMember`, enforces the `billing:manage` capability, and returns the existing provider-unavailable invoice result because `BillingProvider` has no approved invoice retrieval operation. It does not accept a client-supplied customer ID, fabricate records, call an external provider, or expose internal errors.

The route is an authorized unavailable path, not provider-backed invoice functionality. Provider-backed invoices, real download links, payment lifecycle events, and full frontend end-to-end consumption remain pending.

## Phase 9D invoice UI integration

`InvoiceHistoryPanel` now uses `invoiceHistoryApiAdapter` by default and calls the authorized `/api/billing/invoices` route from the settings page. The existing loading, retry/error, provider-unavailable, empty, and populated states remain explicit; hosted invoice links continue to pass through the credential-free HTTPS safety checks in the shared contract.

The `BillingProvider` interface was intentionally not expanded in this slice. No approved provider adapter currently exposes invoice retrieval, so the UI is connected to the real authorization boundary and correctly displays provider-unavailable status without fabricating invoices. Provider capability design, credentials, payment activation, live invoice data, and browser-level end-to-end verification remain pending.

## Phase 10 functional invoice-route verification

The invoice route now has executable coverage through the real `GET /api/billing/invoices` handler using disposable SQLite sessions and workspace fixtures. The tests verify unauthenticated rejection, billing-capability enforcement, cross-workspace denial, and the explicit provider-unavailable response. Provider-backed invoice projection and provider-exception mapping remain pending until an approved adapter exists; no provider response is fabricated by the application or tests.

## Phase 11 account settings integration

The integration branch now includes the schema-safe portion of Member 2's account settings flow: authenticated profile retrieval, display-name updates protected by CSRF validation, password changes that preserve the current session while invalidating other sessions, and an account settings page linked from the dashboard navigation. Account deletion remains visibly unavailable pending the approved retention and deletion contract.

OAuth-provider discovery was intentionally not copied because the current integration schema does not contain the Member 2 Google/GitHub account tables and their migration history conflicts remain unresolved. The integrated projection therefore reports the existing local-password account model only; OAuth account support requires the approved migration compatibility decision.

## Phase 12 Playwright harness

The integration branch now contains a bounded Playwright configuration, local development-server setup, disposable SQLite environment variables, and focused account/invoice specs. The harness does not run migrations, connect to PostgreSQL, use production URLs, or require provider credentials. The unauthenticated account-page redirect passed. Authenticated browser journeys did not complete because the local account/session request remained in the page's loading state, and the 320px account page test detected horizontal overflow; these are unresolved browser failures, not passing evidence. Generated traces are excluded from Git.

## Phase 13 browser-flow diagnosis

The original authenticated fixture race was isolated: the first dashboard navigation could issue `/api/auth` before the login response cookie was available to that navigation, receive `401`, and leave the client layout in `Checking your session…`. The fixture now reloads after the login redirect, verifies `/api/auth` returns `200`, and waits for the checking state to disappear. Direct browser-context checks confirmed `/api/auth` and `/api/account` return `200` with the disposable SQLite session.

The remaining full browser run is not complete evidence: the local Next development server intermittently exceeds the bounded navigation timeout during account-route compilation, and the existing 320px account layout still reports document overflow. No global overflow suppression or authentication bypass was introduced.

## Phase 14 browser reliability and responsive fixes

The focused browser harness now prewarms `/login`, `/dashboard/settings/account`, and `/dashboard/settings` after the local server is ready. Each run uses a unique disposable SQLite database and removes its database/WAL files during teardown, preventing prior profile mutations from contaminating later runs. Assertions use a bounded 30-second expectation timeout; no sleeps or authentication bypasses are used.

The 320px overflow was traced to the dashboard header action group: the search shortcut and GitHub control extended the header to 471px. Mobile padding/gaps were reduced, breadcrumbs can shrink, and the keyboard hint is hidden below the small breakpoint. The repeated focused suite now passes account navigation/profile update/unauthenticated redirect/mobile layout and invoice unavailable/unauthorized cases.
