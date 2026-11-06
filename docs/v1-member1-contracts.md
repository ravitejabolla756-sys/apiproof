# MY OWL V1 — Member 1 Contracts

This document records backend contracts that require coordination with Member 2. Changes must preserve existing clients or include a migration note.

## Email verification (AUTH-05)

- Backend owns token issuance, hashing, expiry, single-use consumption, resend throttling, verification state, and enforcement decisions.
- Member 2 owns templates and delivery presentation. The backend must pass a stable template key and non-secret user-safe variables; raw tokens are never logged or persisted in plaintext.
- Real delivery remains gated until an approved email provider and environment are available.

## Organization access (ORG-05 / ORG-10)

- Backend owns workspace-scoped authorization, role capabilities, revocation, session invalidation and audit events.
- Member 2 owns member/invitation screens. Removal requests must identify `workspaceId` and `userId`; the server derives authorization from the current session and never trusts client role labels.
- Any new role or visible invitation state requires contract review before migration.

## Billing (BILL-02 / BILL-03 / BILL-04 / BILL-10)

- Browser redirects are informational only. Entitlements are granted only from authenticated provider webhooks or an approved server reconciliation.
- Webhook handlers consume raw payload plus provider signature, persist a provider event identity/hash, and return safe error categories without exposing payloads or secrets.
- Subscription state, plan, period boundaries and failure/grace semantics are server-owned. Member 2 may display the resulting projection but cannot write entitlements.
- Provider and price identifiers must be server-side allowlisted. Live payment activation requires explicit owner approval.

## Migration and PRs (MIG-01 / PR-07 / PR-08)

- Deterministic evidence and verification status are authoritative. Model output, if later approved, is untrusted and cannot directly write repositories or merge PRs.
- A post-merge event must bind repository, PR, merge SHA, migration/finding identity and the subsequent scan before resolution is shown as verified.
- Draft PRs remain review-only; no auto-merge contract exists.

## Notifications and operations (SEC-11 / SEC-13)

- Backend emits stable, scrubbed domain event categories and identifiers, not secrets, raw webhook payloads, repository content or tokens.
- Member 2 may render/deliver notifications, but delivery failure must not change authorization or billing truth.
- Alert destinations, retention and escalation policy require owner approval before staging/production configuration.

## Change log

- 2026-11-06: Phase 0 initialized this contract document from the clean `origin/main` baseline. No endpoint, schema or event contract was changed in Phase 0.
