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

### Current role boundary and proposed revocation contract

- The current persisted role vocabulary is deliberately limited to `owner` and `member`; no `admin` role is granted or accepted by current UI/API flows. A future `admin` role requires a reviewed capability matrix and migration before it is added.
- `owner` is required for provider-rule review/seed/test operations and workspace-owner-only GitHub installation reassociation. `member` is sufficient for workspace-scoped reads and ordinary repository/integration operations that already use `requireWorkspaceMember`.
- Every authorization decision is derived from `(session.userId, workspaceId)` and a current `workspace_members` row. A client-supplied role, workspace name, repository owner/name, or invitation state is non-authoritative.
- Proposed removal request shape for Member 2 review: `{ workspaceId, userId, reason? }`. The server must return a non-enumerating authorization error for a missing workspace/member and must reject removal of the final owner unless an approved ownership-transfer flow exists.
- Proposed durable revocation event shape for review: `workspace.member_revocation.v1` with `{ eventId, workspaceId, subjectUserId, actorUserId, membershipId, reason, occurredAt, idempotencyKey }`. Consumers must treat `eventId`/`idempotencyKey` as durable deduplication keys and must not infer authorization from the event alone.
- Revocation processing must invalidate only the removed subject's sessions, email/password-reset/OAuth state and workspace-scoped queued jobs; it must preserve unrelated personal sessions and other workspace memberships. All resource queries must re-check current membership at execution time.
- The revocation flow is not implemented yet because the invitation schema, member-management UI, audit-event ownership and final-owner policy require Member 2/owner approval.

## Retention and deletion (SEC-19)

- Account security data (`users`, password hash, OAuth identities, sessions, password-reset tokens and email-verification tokens) is user-scoped. Account closure must invalidate sessions/tokens first, then delete or anonymize the account according to the approved legal policy; it must not delete another user's workspaces or memberships implicitly.
- Workspace operational data (`workspace_members`, repositories, scans, findings, migrations, pull requests, resolution/lifecycle evidence, activity, provider rescans, Slack deliveries/actions and worker jobs) is workspace-scoped. A workspace deletion request must either cascade through an approved retention plan or enter an auditable anonymization workflow; no current endpoint performs this operation.
- Billing records (`workspace_subscriptions`, usage and provider webhook/event records) and future invoice identifiers are retention-sensitive. They must be retained for the approved statutory/provider period while access is revoked and personal data is minimized where legally permitted.
- Backups are an independent retention boundary. A successful application deletion request cannot claim that backup copies were erased; the response must expose the approved backup-expiry policy/status instead.
- Proposed durable request states for review are `requested`, `processing`, `completed`, `failed` and `cancelled`, keyed by an idempotency key and carrying `workspaceId`/`subjectUserId`, actor, timestamps, policy version, scrubbed outcome and audit reference. Cross-tenant requests must fail before any mutation.
- Member 2 review is required for confirmation/re-authentication UX, workspace selection, impact disclosure, status polling and account-vs-workspace deletion wording. Legal/owner approval is required for retention periods, statutory billing retention and backup expiry before implementation or destructive testing.

## Billing (BILL-02 / BILL-03 / BILL-04 / BILL-10)

- Browser redirects are informational only. Entitlements are granted only from authenticated provider webhooks or an approved server reconciliation.
- Webhook handlers consume raw payload plus provider signature, persist a provider event identity/hash, and return safe error categories without exposing payloads or secrets.
- Subscription state, plan, period boundaries and failure/grace semantics are server-owned. Member 2 may display the resulting projection but cannot write entitlements.
- Provider and price identifiers must be server-side allowlisted. Live payment activation requires explicit owner approval.

## Migration and PRs (MIG-01 / PR-07 / PR-08)

- Deterministic evidence and verification status are authoritative. Model output, if later approved, is untrusted and cannot directly write repositories or merge PRs.
- A post-merge event must bind repository, PR, merge SHA, migration/finding identity and the subsequent scan before resolution is shown as verified.
- Merged pull requests persist `merge_sha`; the durable scan queue is unique on `(repository_id, commit_sha)` and the worker records resolution evidence only for the exact merged commit. Duplicate deliveries converge on the existing request/scan.
- Resolution evidence is immutable and idempotent per migration/scan. `resolved` requires absence from a completed exact-commit scan; `unresolved` means the finding remains; `regressed` means it reappears after a prior verified state; `ambiguous` protects a matching active change; `inconclusive` covers missing baseline evidence. No classification grants merge or deployment authority.
- Draft PRs remain review-only; no auto-merge contract exists.

## Provider change classification (PROV-05)

- Candidate and compatibility evidence remains review-gated. A source parser must preserve the provider, source URL, excerpt and locator when it rejects a record; it must not convert contradictory support/removal claims or unsupported semantic-change prose into a reviewed removal.
- A compatibility record scoped to `resource` or `api_version` cannot be classified `NOT_AFFECTED` when the corresponding usage evidence is absent. The result is `NEEDS_REVIEW` with an explicit unresolved reason (`RESOURCE_UNRESOLVED` or `API_VERSION_UNRESOLVED`).
- Renamed/removed targets, version ranges and semantic parameter conditions remain deterministic only when the provider, target and version evidence are affirmative. Dynamic, low-confidence, contradictory or incomplete evidence remains `NEEDS_REVIEW`.
- Cross-provider evidence is isolated by provider identity; a usage from another provider cannot satisfy a reviewed change. These rules are locally tested and are not production/provider-freshness proof.

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
- The protected provider-intelligence status response exposes tenant-neutral scan queue telemetry under `queues.worker`: depth counters, `oldestPendingAt`, bounded `oldestPendingAgeMs`, `retryingJobs`, `stalledProcessingJobs` and `retryExhaustedJobs`. It exposes no workspace, repository, source body or credential data.
- `stalledProcessingJobs` is derived only from an expired persisted lease; `retryExhaustedJobs` is derived from the queue's bounded attempt count. These are indicators for an owner-approved monitor, not automatic authorization, deletion or retry decisions.
- Alert destinations, retention and escalation policy require owner approval before staging/production configuration.

## HTTP security (SEC-08)

- `APIPROOF_CORS_ORIGINS` is an optional comma-separated allowlist of exact HTTP(S) origins. Empty means same-origin only; wildcard origins are rejected.
- Credentialed CORS is emitted only for an allowlisted origin, and preflight requests from other origins receive a 403 response.
- The CSP intentionally retains `unsafe-inline` for current Next App Router hydration and inline UI styles; development alone adds `unsafe-eval`. A future nonce migration can tighten these exceptions after browser coverage is available.

## Change log

- 2026-11-06: Phase 0 initialized this contract document from the clean `origin/main` baseline. No endpoint, schema or event contract was changed in Phase 0.
- 2026-11-07: Added the local AUTH-05 token/API/schema contract. Provider delivery, Member 2 template approval, and final unverified-account enforcement remain separate gates.
- 2026-11-07: Added the local IMP-09 audited finding lifecycle, migration 025, scan/plan/PR integrations, idempotency/concurrency tests and explicit completed-scan evidence requirements.
- 2026-11-07: Added PR-07 merged-SHA persistence/deduplicated scan queue handling and PR-08 exact-commit finding-resolution classifications/evidence migration 026; live GitHub/PostgreSQL execution remains unverified.
- 2026-11-07: Documented the current owner/member boundary plus proposed ORG-10 revocation event and SEC-19 retention/deletion request contracts; implementation remains gated on Member 2, legal and owner policy review.
- 2026-11-07: Added tenant-neutral scan queue age/retry/stalled-lease telemetry to the existing protected status projection; alert delivery, heartbeat ownership and worker-death rehearsal remain external gates.
