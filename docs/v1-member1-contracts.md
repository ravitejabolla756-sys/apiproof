# MY OWL V1 — Member 1 Contracts

This document records backend contracts that require coordination with Member 2. Changes must preserve existing clients or include a migration note.

## Email verification (AUTH-05)

- Backend owns token issuance, hashing, expiry, single-use consumption, resend throttling, verification state, and enforcement decisions. The current API actions are `verify_email` and authenticated `resend_email_verification` on `POST /api/auth`.
- The action URL keeps the token in the URL fragment; the server receives it only through the explicit verification POST and never logs or persists it in plaintext.
- The current SMTP delivery adapter renders the password-reset-compatible fallback template and accepts `EMAIL_FROM` with `PASSWORD_RESET_FROM` as a compatibility fallback. Member 2 must approve the final template key/variables contract before production delivery; this workstream does not claim that approval.
- Existing OAuth providers only set `users.email_verified_at` after the provider's own verified-email check. Matching a provider email to an existing password account still does not link or verify that account automatically.
- Real delivery remains gated until an approved email provider and environment are available.

## Organization access (ORG-05 / ORG-10)

- Backend owns workspace-scoped authorization, role capabilities, membership revocation, worker revalidation and audit events. Current user sessions remain user-scoped; this contract does not authorize global session deletion.
- Member 2 owns member/invitation screens. Removal requests must identify `workspaceId` and `userId`; the server derives authorization from the current session and never trusts client role labels.
- Any new role or visible invitation state requires contract review before migration.

### Current role boundary and proposed revocation contract

- The current persisted role vocabulary is deliberately limited to `owner` and `member`; the centralized policy recognizes `admin` only as a reserved capability vocabulary, and no current UI/API flow grants it. Provisioning `admin` requires a reviewed migration and cross-member contract.
- `owner` is required for provider-rule review/seed/test operations and workspace-owner-only GitHub installation reassociation. `member` is sufficient for workspace-scoped reads and ordinary repository/integration operations that already use `requireWorkspaceMember`.
- Every authorization decision is derived from `(session.userId, workspaceId)` and a current `workspace_members` row. A client-supplied role, workspace name, repository owner/name, or invitation state is non-authoritative.
- Member 1's backend service accepts `{ workspaceId, userId, reason?, idempotencyKey }` plus the authenticated `actorUserId`. The server derives actor role, target membership, owner count and membership ID from the current transaction. Missing/non-member/cross-tenant requests fail closed; self-removal remains a separate workflow; the final owner cannot be removed.
- The service returns `{ requestId, eventId, status: "completed", workspaceId, subjectUserId, subjectMembershipId, actorUserId, reason?, idempotencyKey }` and persists the request under `(workspaceId, idempotencyKey)`. A repeated identical request returns the same terminal result; a reused key for another actor/subject/reason fails with `REVOCATION_IDEMPOTENCY_CONFLICT`.
- Durable event shape: `workspace.member_revocation.v1` with `{ eventId, workspaceId, subjectUserId, actorUserId, membershipId, reason, occurredAt, idempotencyKey }`. It is stored in `workspace_security_audit_events` with scrubbed JSON payload; consumers must treat `eventId`/`idempotencyKey` as deduplication keys and must not infer authorization from the event alone.
- Revocation processing deletes only the selected `workspace_members` row and immediately invalidates organization access because all resource queries resolve current membership. The current user-scoped `sessions` row remains valid for personal authentication and other workspace memberships; no global session deletion is permitted. User-attributed verification and Slack worker jobs re-check current membership immediately before execution and fail with `WORKSPACE_ACCESS_REVOKED`; organization-owned jobs without an initiator remain intact.
- `workspace-policy.ts` is the local central role/capability boundary. It fails closed on unknown persisted roles, keeps owner-only destructive capabilities separate from member operations, and is not yet adopted by routes whose final permissions depend on the Member 2 organization contract.
- The durable revocation flow is locally implemented through migration 027 and `revokeWorkspaceMember`; it does not delete accounts, unrelated workspace data or legally retained records. Member 2's separate branch provides the reviewed `workspace_invitations` schema/service and `/api/workspace/members` route, but those files are not integrated into this branch. Integration must revoke matching pending invitations transactionally and project the authoritative event into Member 2's existing audit table; HTTP response mapping, confirmation/re-authentication, status polling and audit visibility remain Member 2/owner review gates.

## Retention and deletion (SEC-19)

- Account security data (`users`, password hash, OAuth identities, sessions, password-reset tokens and email-verification tokens) is user-scoped. Account closure must invalidate sessions/tokens first, then delete or anonymize the account according to the approved legal policy; it must not delete another user's workspaces or memberships implicitly.
- Workspace operational data (`workspace_members`, repositories, scans, findings, migrations, pull requests, resolution/lifecycle evidence, activity, provider rescans, Slack deliveries/actions and worker jobs) is workspace-scoped. A workspace deletion request must either cascade through an approved retention plan or enter an auditable anonymization workflow; no current endpoint performs this operation.
- Billing records (`workspace_subscriptions`, usage and provider webhook/event records) and future invoice identifiers are retention-sensitive. They must be retained for the approved statutory/provider period while access is revoked and personal data is minimized where legally permitted.
- Backups are an independent retention boundary. A successful application deletion request cannot claim that backup copies were erased; the response must expose the approved backup-expiry policy/status instead.
- Proposed durable request states for review are `requested`, `processing`, `completed`, `failed` and `cancelled`, keyed by an idempotency key and carrying `workspaceId`/`subjectUserId`, actor, timestamps, policy version, scrubbed outcome and audit reference. Cross-tenant requests must fail before any mutation.
- Member 2 review is required for confirmation/re-authentication UX, workspace selection, impact disclosure, status polling and account-vs-workspace deletion wording. Legal/owner approval is required for retention periods, statutory billing retention and backup expiry before implementation or destructive testing.

### Missing decisions and implementation-ready acceptance scenarios

- Member 2 must confirm whether the member-management action is `remove member`, `leave workspace`, or `close account`; these are different authorization and retention operations and must not share a destructive endpoint accidentally.
- Member 2 must confirm confirmation/re-authentication requirements, workspace/member selection behavior, impact disclosure, status polling, and the UI treatment of `requested`, `processing`, `completed`, `failed` and `cancelled` states.
- Owner/legal must confirm final-owner behavior (ownership transfer required versus an approved owner-only workspace closure), statutory billing/invoice retention, backup expiry wording, and whether anonymization is preferred over deletion for retained records.
- The current `sessions` table is user-scoped rather than workspace-scoped. The local ORG-10 implementation therefore revokes the workspace membership and preserves the subject's personal session and other memberships. Member 2/owner must still approve any future workspace-session binding or revocation-marker UX; deleting every session for the user would incorrectly terminate unrelated access.
- Member 2 must confirm the response/error mapping and idempotency-key lifecycle, whether pending invitations are invalidated immediately (the separate branch uses `workspace_invitations` with `accepted_at`/`revoked_at`), whether queued workspace jobs are cancelled or allowed to drain, and which audit events are visible to workspace owners versus platform operators. The implemented worker safety rule is fail-closed membership revalidation for user-attributed jobs.

The following tests are implementation-ready but remain contract-gated; they intentionally do not authorize a deletion endpoint or destructive migration:

- ORG-10-A: an authorized owner removes a non-owner member; the membership is revoked, the removed subject's workspace-scoped API/session/job paths deny access, and unrelated personal sessions plus memberships in another workspace remain valid.
- ORG-10-B: a non-owner, non-member, cross-workspace, missing-member, or client-role-manipulated request fails with a non-enumerating authorization response and performs no mutation.
- ORG-10-C: removal of the final owner is rejected unless the approved ownership-transfer contract is present; concurrent removal attempts produce one durable revocation event and one terminal request outcome.
- ORG-10-D: duplicate idempotency keys return the existing request/event outcome; a reused key with a different workspace, subject, or operation fails closed.
- ORG-10-E: once the invitation contract exists, pending invitations follow the approved invalidation policy; user-attributed queued operations fail closed after membership revocation, while independently authorized organization-owned operations continue; every queued operation re-checks current membership at execution time.
- SEC-19-A: account closure invalidates sessions and account-recovery tokens before deletion/anonymization; a retry is idempotent and cannot affect another user's workspace.
- SEC-19-B: workspace deletion/anonymization is tenant-scoped, records an auditable request state, preserves statutory billing records according to the approved policy, and exposes backup-expiry status without claiming backups were erased.
- SEC-19-C: cross-tenant deletion requests fail before mutation; failed processing is resumable and records a scrubbed outcome plus audit reference.

## Billing (BILL-02 / BILL-03 / BILL-04 / BILL-10)

- Browser redirects are informational only. Entitlements are granted only from authenticated provider webhooks or an approved server reconciliation.
- Webhook handlers consume raw payload plus provider signature, persist a provider event identity/hash, and return safe error categories without exposing payloads or secrets.
- The mock provider is development/test-only and is unavailable under `NODE_ENV=production`; its webhook verifier requires an explicitly configured secret of at least 32 UTF-8 bytes, a bounded raw body, a well-formed fixed-length HMAC, and a stable provider event ID/type. No fallback signing secret or generated event identity is permitted.
- Normalized webhook status and plan identifiers must belong to the existing application contracts; supplied billing-period values must parse as valid dates. Provider-specific prices remain unmapped until an approved provider contract defines their allowlist.
- Webhook deduplication claim and subscription projection update share one database transaction. A unique `(provider, payload_hash)` conflict is an acknowledged duplicate; database failure rolls back both receipt and state change. Production PostgreSQL concurrency still requires staging verification.
- Billing webhook HTTP errors expose only stable safe categories; parser, provider and database exception details are not returned to callers. Production billing/portal routes fail closed with 503 until an approved provider adapter is selected and configured.
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
- Protected operational status includes per-run heartbeat status and sanitized error code for the scan worker, six-hour provider-changelog scheduler, and nightly rescan scheduler. Scheduler freshness is measured against 12-hour and 30-hour proposed windows; scan-worker cadence is intentionally `unknown` until its actual scheduler is confirmed. Alert destinations and final thresholds still require owner approval.
- Heartbeat records use independent run IDs to preserve overlapping invocations, retain only the most recent 100 completed records per component (active runs are retained), and do not contain tenant or credential data. Telemetry writes are best-effort and cannot change the worker outcome.
- Apply `sec13_worker_run_heartbeats_v1` through the existing migration workflow before relying on persisted heartbeat values. Until then, or if the heartbeat store is unavailable, protected status remains available and reports an explicit unknown heartbeat state.
- Alert destinations, retention and escalation policy require owner approval before staging/production configuration.

## Load and resilience testing (SEC-16)

- The local SEC-16 harness is test-only and in-process. It refuses `NODE_ENV=production`, creates no HTTP client or socket, and uses an isolated SQLite database path under `.tmp`.
- Workloads are bounded by hard iteration, concurrency, timeout and retry limits. Reports include total/success/failure counts, sanitized error categories, throughput, max in-flight operations, and p50/p95/p99 latency.
- Local scenarios cover health/API execution, signed webhook verification and durable delivery claim/record, SQLite queries, and queue telemetry. Failure injection is deterministic and limited to the harness callback; it cannot reach a provider or production resource.
- Staging execution remains a separate gate requiring approved traffic limits, fixture data, metrics/SLO thresholds, worker failure injection, and recovery evidence.

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
- 2026-11-07: Added tenant-neutral queue indicators and per-run worker/scheduler heartbeats to the existing protected status projection; alert delivery and staged worker-death rehearsal remain external gates.
- 2026-11-07: Added the local ORG-05 role/capability policy with fail-closed unknown-role handling; route adoption and admin provisioning remain contract-gated.
- 2026-11-07: Added implementation-ready ORG-10/SEC-19 acceptance scenarios and recorded missing Member 2, legal and owner decisions; no destructive endpoint or migration was added.
- 2026-11-07: Implemented local ORG-10 migration 027, atomic tenant-scoped membership revocation, durable security audit records, idempotency/concurrency handling and worker-time membership revalidation. Invitation invalidation and the Member 2 HTTP/UI contract remain open decisions.
- 2026-11-07: Added the local-only SEC-16 harness contract; staging load, failure-injection and recovery evidence remain external gates.
- 2026-11-07: Added the non-destructive ORG-10 revocation-plan boundary and contract tests; durable request persistence, selective session invalidation and membership mutation remain gated.
- 2026-11-08: Hardened the local billing boundary so mock verification cannot run in production, removed the built-in signing-secret fallback, required stable event identity/type, bounded payloads and fixed-length HMACs, and sanitized webhook/portal unavailability responses. Provider selection, sandbox credentials and paid activation remain blocked pending owner approval.
