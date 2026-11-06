# MY OWL V1 — Member 1 Contracts

This document records backend contracts that require coordination with Member 2. Changes must preserve existing clients or include a migration note.

## Email verification (AUTH-05)

- Backend owns token issuance, hashing, expiry, single-use consumption, resend throttling, verification state, and enforcement decisions. The current API actions are `verify_email` and authenticated `resend_email_verification` on `POST /api/auth`.
- The action URL keeps the token in the URL fragment; the server receives it only through the explicit verification POST and never logs or persists it in plaintext.
- The current SMTP delivery adapter renders the password-reset-compatible fallback template and accepts `EMAIL_FROM` with `PASSWORD_RESET_FROM` as a compatibility fallback. Member 2 must approve the final template key/variables contract before production delivery; this workstream does not claim that approval.
- Existing OAuth providers only set `users.email_verified_at` after the provider's own verified-email check. Matching a provider email to an existing password account still does not link or verify that account automatically.
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

### MIG-01 AI recommendation boundary

- The production planning route currently uses `DeterministicPlanner` only. It constructs a bounded, redacted `PlanningInput` from the reviewed provider registry, exact finding location, scan evidence and source digest, then persists a human-review-required plan; it does not modify source code.
- `LLMPlanner` exists as a provider-agnostic core boundary for a future approved adapter. Its output is strict-schema validated, constrained to supplied symbols/files/evidence, marked `PLAN_NEEDS_REVIEW`, capped at 0.7 planning confidence and never treated as verification.
- No production model provider, credential, structured-output contract, cost budget, retry/timeout policy or approval exists in this workstream. The web route therefore must remain deterministic-only until those controls are approved and implemented together.
- Deterministic patch generation, bounded isolated verification, provenance digests and sandbox checks are the only path to execution-backed migration evidence. Model output cannot select commands, files, registry rules, repository writes, merge operations or verification status.

## Finding lifecycle (IMP-09)

- Findings persist a lifecycle state independently of the legacy display `status`: `open`, `acknowledged`, `remediating`, `fixed_pending_verification`, `verified_resolved`, `reopened`, and the migration-only `resolved_legacy` state.
- Every detected finding and accepted transition writes one immutable audit event with workspace/repository identity, actor, reason, evidence and a unique idempotency key. Reusing a key for a different finding, tenant or target state fails closed.
- State changes require the repository's workspace identity and use a conditional update inside a transaction. SQLite serializes independent top-level transactions and uses savepoints for nested service operations; PostgreSQL uses transaction savepoints.
- `verified_resolved` requires evidence of a completed scan for the same repository. A finding that reappears in a later completed scan transitions to `reopened`; absence from a completed scan is the only scanner-driven resolution path.
- The worker preserves active remediation until a completed scan supplies evidence, while planning and draft-PR services advance the lifecycle without granting merge or deployment authority.

## Notifications and operations (SEC-11 / SEC-13)

- Backend emits stable, scrubbed domain event categories and identifiers, not secrets, raw webhook payloads, repository content or tokens.
- Member 2 may render/deliver notifications, but delivery failure must not change authorization or billing truth.
- Alert destinations, retention and escalation policy require owner approval before staging/production configuration.

## HTTP security (SEC-08)

- `APIPROOF_CORS_ORIGINS` is an optional comma-separated allowlist of exact HTTP(S) origins. Empty means same-origin only; wildcard origins are rejected.
- Credentialed CORS is emitted only for an allowlisted origin, and preflight requests from other origins receive a 403 response.
- The CSP intentionally retains `unsafe-inline` for current Next App Router hydration and inline UI styles; development alone adds `unsafe-eval`. A future nonce migration can tighten these exceptions after browser coverage is available.

## Change log

- 2026-11-06: Phase 0 initialized this contract document from the clean `origin/main` baseline. No endpoint, schema or event contract was changed in Phase 0.
- 2026-11-07: Added the local AUTH-05 token/API/schema contract. Provider delivery, Member 2 template approval, and final unverified-account enforcement remain separate gates.
- 2026-11-07: Added the local IMP-09 audited finding lifecycle, migration 025, scan/plan/PR integrations, idempotency/concurrency tests and explicit completed-scan evidence requirements.
