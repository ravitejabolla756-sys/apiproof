# MY OWL V1 — Member 1 Contracts

This document records backend contracts that require coordination with Member 2. Changes must preserve existing clients or include a migration note.

## Email verification (AUTH-05)

- Backend owns token issuance, hashing, expiry, single-use consumption, resend throttling, verification state, and enforcement decisions. The current API actions are `verify_email` and authenticated `resend_email_verification` on `POST /api/auth`.
- The action URL keeps the token in the URL fragment; the server receives it only through the explicit verification POST and never logs or persists it in plaintext.
- Verification token issuance and consumption serialize on the owning user row in PostgreSQL (and through the serialized SQLite transaction adapter). Verification re-reads token state after acquiring that lock, so a concurrent resend invalidates earlier tokens before they can be consumed; only one outstanding token per account remains valid after concurrent resends.
- The current SMTP delivery adapter renders the password-reset-compatible fallback template and accepts `EMAIL_FROM` with `PASSWORD_RESET_FROM` as a compatibility fallback. Member 2 must approve the final template key/variables contract before production delivery; this workstream does not claim that approval.
- Existing OAuth providers only set `users.email_verified_at` after the provider's own verified-email check. Matching a provider email to an existing password account still does not link or verify that account automatically.
- Expired Google/GitHub login state rows are pruned in deterministic batches of at most 1,000 on the next state creation, ordered by expiry and hash and using the existing expiry indexes. Later login attempts continue cleanup; unexpired consumed rows remain until expiry so replay detection is preserved. This cleanup applies only to transient OAuth state, not linked provider identities.
- Persistent auth throttles use atomic fixed-window increments shared by SQLite/PostgreSQL adapters. Denied requests remain denied, while the stored counter is capped at one above the configured limit; provider/proxy-specific client-IP trust still needs staging validation.
- Real delivery remains gated until an approved email provider and environment are available.

## Session lifetime (AUTH-10)

- The browser authentication cookie's `Expires` and `Max-Age` must both reflect the persisted session expiry; `Max-Age` is capped at the remaining session lifetime and the configured maximum session TTL. Past or malformed expiry values immediately expire the cookie. Server-side session validation remains authoritative, so cookie expiry does not replace database validation.

## Organization access (ORG-05 / ORG-10)

- Backend owns workspace-scoped authorization, role capabilities, membership revocation, worker revalidation and audit events. Current user sessions remain user-scoped; this contract does not authorize global session deletion.
- Member 2 owns member/invitation screens. Removal requests must identify `workspaceId` and `userId`; the server derives authorization from the current session and never trusts client role labels.
- Any new role or visible invitation state requires contract review before migration.

### Current role boundary and proposed revocation contract

- The current persisted role vocabulary is deliberately limited to `owner` and `member`; the centralized policy recognizes `admin` only as a reserved capability vocabulary, and no current UI/API flow grants it. Provisioning `admin` requires a reviewed migration and cross-member contract.
- `owner` is required for provider-rule review/seed/test operations and workspace-owner-only GitHub installation reassociation. `member` is sufficient for workspace-scoped reads and ordinary repository/integration operations that already use `requireWorkspaceMember`.
- Every authorization decision is derived from `(session.userId, workspaceId)` and a current `workspace_members` row. A client-supplied role, workspace name, repository owner/name, or invitation state is non-authoritative.
- Slack OAuth callbacks consume state bound to the initiating user, re-read current workspace membership before exchanging the authorization code, and recheck membership during token persistence. Revoked membership must prevent token exchange and persistence; the second check covers revocation during the provider round trip.
- `GET /api/github/install` verifies current workspace membership before generating a persisted, single-use installation state. Per-user state creation is capped at 10 attempts per 15 minutes and fails closed when the rate-limit store is unavailable; all responses containing OAuth state are private/no-store. This does not replace workspace-role approval or staging verification of PostgreSQL/proxy behavior.
- Installation-state signing/configuration failures return a generic non-cacheable server error; underlying configuration/exception text is not returned to the client, and failed creation leaves no state row.
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
- The billing webhook route enforces a 256 KiB byte ceiling while consuming the request stream, before collecting the full payload. Strict UTF-8 decoding preserves the signed bytes (including a BOM) for HMAC verification; invalid UTF-8, malformed lengths, and overflow fail with a generic invalid-webhook response.
- Normalized webhook status and plan identifiers must belong to the existing application contracts; supplied billing-period values must parse as valid dates and, when both are present, the period end must be later than its start. Provider-specific prices remain unmapped until an approved provider contract defines their allowlist.
- The shared billing projector revalidates normalized provider events before opening a transaction: event identity and raw-body sizes are bounded, identifiers and enum values are checked, and supplied period intervals must be valid. Provider adapters cannot bypass these checks by constructing `BillingWebhookEvent` directly.
- The local projector applies subscription changes only for `customer.subscription.updated` with an explicit normalized status, `customer.subscription.deleted` (forced to canceled/free), and `invoice.payment_failed` (forced to past_due). Unknown event types and incomplete subscription snapshots may be durably recorded for idempotency but must not change entitlements or subscription state.
- Webhook deduplication claim and subscription projection update share one database transaction. A unique `(provider, payload_hash)` conflict is an acknowledged duplicate; database failure rolls back both receipt and state change. Production PostgreSQL concurrency still requires staging verification.
- Billing webhook HTTP errors expose only stable safe categories; parser, provider and database exception details are not returned to callers. Production billing/portal routes fail closed with 503 until an approved provider adapter is selected and configured.
- Browser POST requests to billing checkout and portal enforce the shared Origin/Referer and Fetch Metadata CSRF checks before authentication or provider work; cross-site requests receive the stable `CSRF_REJECTED` response. Clients must submit these mutations same-origin.
- Browser `DELETE /api/repositories/{id}` requests enforce the same CSRF boundary before authentication, membership lookup or repository mutation; cross-site requests receive `CSRF_REJECTED` and do not delete the repository.
- Repository operations must normalize the persisted workspace role at the authorization boundary. Unknown roles fail closed; a denied repository DELETE returns the generic not-found response and leaves the row unchanged.
- Subscription state, plan, period boundaries and failure/grace semantics are server-owned. Member 2 may display the resulting projection but cannot write entitlements.
- Local usage authorization permits only `active` and `trialing` subscriptions; `canceled`, `past_due`, `unpaid`, `incomplete`, and unrecognized persisted states fail closed. The exact grace period and notification/suspension sequence remain owner decisions.
- Usage bucket increments use one UPSERT over `(workspace_id, metric, period_start)` to avoid read/update races. SQLite concurrency has local regression evidence; real PostgreSQL concurrency and provider lifecycle correctness remain open gates.
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
- The structured server logger redacts common Stripe, Slack, AWS, Google and Supabase token formats and sensitive credential-bearing context fields. Diagnostic identifiers such as `envName` and `secretName` remain visible; this protects local log output but does not replace owner-approved monitoring, retention or alert routing.
- Direct GitHub-provider and rate-limit fallback console paths emit fixed operational messages only; raw exception objects are not passed to `console`. API/server console call sites were re-audited on 2026-11-08; this does not verify external log sinks or retention.
- Durable provider-rescan and proposal-verification worker rows retain safe error categories but store fixed generic error messages; raw provider/runtime exception text is not persisted in these status fields.
- Scan-worker error codes are extracted only from an explicit application allowlist; unknown uppercase or secret-shaped exception strings use the fixed caller fallback.
- Scan-worker partial execution persists a degraded heartbeat with the stable `SCAN_WORKER_DEGRADED` code; exception text remains outside the heartbeat contract.
- Provider-rule edit/review APIs expose only allowlisted error codes. Dynamic applicability errors are reduced to static prefixes; unknown exception messages are never returned to clients.
- Member 2 may render/deliver notifications, but delivery failure must not change authorization or billing truth.
- The protected provider-intelligence status response exposes tenant-neutral scan queue telemetry under `queues.worker`: depth counters, `oldestPendingAt`, bounded `oldestPendingAgeMs`, `retryingJobs`, `stalledProcessingJobs` and `retryExhaustedJobs`. It exposes no workspace, repository, source body or credential data.
- `stalledProcessingJobs` is derived only from an expired persisted lease; `retryExhaustedJobs` is derived from the queue's bounded attempt count. These are indicators for an owner-approved monitor, not automatic authorization, deletion or retry decisions.
- Protected operational status includes per-run heartbeat status and sanitized error code for the scan worker, six-hour provider-changelog scheduler, and nightly rescan scheduler. Scheduler freshness is measured against 12-hour and 30-hour proposed windows; scan-worker cadence is intentionally `unknown` until its actual scheduler is confirmed. Alert destinations and final thresholds still require owner approval.
- Heartbeat records use independent run IDs to preserve overlapping invocations, retain only the most recent 100 completed records per component (active runs are retained), and do not contain tenant or credential data. Telemetry writes are best-effort and cannot change the worker outcome.
- Apply `sec13_worker_run_heartbeats_v1` through the existing migration workflow before relying on persisted heartbeat values. Until then, or if the heartbeat store is unavailable, protected status remains available and reports an explicit unknown heartbeat state.
- Alert destinations, retention and escalation policy require owner approval before staging/production configuration.

## Load and resilience testing (SEC-16)

- The local SEC-16 harness is test-only and in-process. It refuses `NODE_ENV=production` and any configured `DATABASE_URL`, `APIPROOF_DATABASE_URL`, or `APIPROOF_STAGING_DATABASE_URL`, creates no HTTP client or socket, and uses an isolated SQLite database path under `.tmp`.
- Workloads are bounded by hard iteration, concurrency, timeout and retry limits. Reports include total/success/failure counts, sanitized error categories, actual-start throughput, max in-flight operations, and p50/p95/p99 latency. If a timeout prevents scheduling, unstarted iterations do not inflate measured throughput.
- Local scenarios cover health/API execution, signed webhook verification and durable delivery claim/record, SQLite queries, and queue telemetry. Failure injection is deterministic and limited to the harness callback; it cannot reach a provider or production resource.
- Load-report error categories are explicitly allowlisted harness codes; unrecognized exception messages collapse to `OPERATION_FAILED` so credential-like values cannot be copied into reports.
- Staging execution remains a separate gate requiring approved traffic limits, fixture data, metrics/SLO thresholds, worker failure injection, and recovery evidence.

## HTTP security (SEC-08)

- `APIPROOF_CORS_ORIGINS` is an optional comma-separated allowlist of exact HTTP(S) origins. Empty means same-origin only; wildcard origins are rejected.
- Credentialed CORS is emitted only for an allowlisted origin, and preflight requests from other origins receive a 403 response.
- The CSP intentionally retains `unsafe-inline` for current Next App Router hydration and inline UI styles; development alone adds `unsafe-eval`. A future nonce migration can tighten these exceptions after browser coverage is available.
- CSRF origin validation accepts a single normalized `X-Forwarded-Proto` value from the trusted proxy path; comma-separated values are ambiguous and fail closed. Proxy provenance and normalization must be confirmed in staging before production reliance.
- `Origin` must be a serialized origin only; credentials, path, query, fragment, or noncanonical URL serialization are rejected rather than normalized. `Referer` remains a full URL and is compared by origin tuple.
- The browser-session `/api/github/install` endpoint creates durable one-time installation state and therefore validates Origin/Referer and Fetch Metadata on both GET and POST before authentication, rate-limit consumption, or state creation; cross-site calls receive `CSRF_REJECTED`.
- The compatibility POST alias on `/api/github/callback` applies the same CSRF check before delegating to the GitHub GET callback; the actual cross-site GitHub redirect remains on GET and is protected by session-bound, expiring, atomically single-use state.

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
- 2026-11-08: Made billing event receipt and projection updates atomic, and aligned limit enforcement with the subscription activity projection so incomplete/unrecognized states cannot grant usage. Added concurrent delivery and subscription-state regression tests; PostgreSQL and provider-sandbox proof remain open.
- 2026-11-08: Added route-level Slack OAuth membership revalidation, bounded streaming billing webhook reads, atomic workspace usage and fixed-window rate-limit counters, and local regressions. These do not replace Member 2 capability approval, PostgreSQL validation, approved billing-provider tests, proxy trust review or staging evidence.
- 2026-11-08: Tightened the rate-limit UPSERT to keep quota-filling requests allowed, reject all following requests, and cap the persisted counter at limit+1. Regressions, typecheck and build pass; full serial suite has not been rerun after this narrow correction.
- 2026-11-08: CSRF origin derivation now rejects comma-separated forwarded protocol values while retaining single-value proxy support; local regression, lint and typecheck pass. Deployed proxy normalization remains an external verification gate.
- 2026-11-08: Billing webhook event IDs cannot silently project a conflicting signed payload: durable uniqueness conflicts are checked against the stored provider/type/hash, returning a generic 409 for identity reuse while preserving duplicate delivery idempotency. Provider-specific semantics and PostgreSQL evidence remain open.

- 2026-11-08 SEC-11: Migration planning/proposal API errors must expose only reviewed generic messages and stable codes; exception text must not be returned to clients or emitted in route logs. Local regression coverage is in `tests/migration-api-error-safety.test.ts`. This local response hardening does not define external monitoring or alert-routing policy.
- 2026-11-08 SEC-11: `/api/inventory` registry-loading failures return a fixed generic response; regression coverage is in `tests/inventory-error-safety.test.ts`. Exception content may contain provider or credential details and must not be returned to clients.
- 2026-11-08 SEC-11: GitHub repository-list responses preserve the reviewed `GITHUB_AUTH_FAILED` mapping; all unexpected service errors use a fixed generic `INTERNAL_ERROR` response and do not expose exception text.
- 2026-11-08 SEC-11: Slack connect failures return a fixed user-facing message; configuration and storage exception details remain server-side. Regression coverage is in `tests/slack-phase1.test.ts`.
- 2026-11-08 SEC-11: Repository connection retains its reviewed `FORBIDDEN` and `REPOSITORY_ALREADY_CONNECTED` outcomes; unexpected persistence exceptions map to fixed `INTERNAL_ERROR` without returning exception content.
- 2026-11-08 SEC-11: GitHub installation callback maps known foreign/missing installation cases to `UNKNOWN_INSTALLATION`; other provider failures return fixed `GITHUB_API_ERROR` text without echoing provider exception content.
- 2026-11-08 AUTH-10: Session expiry is exclusive: `expires_at <= now` is invalid. The sync and async validators must reject and purge malformed, past, and exactly-at-current-instant expiry values.
- ORG-10 concurrent owner-removal regression: a local SQLite race test confirms concurrent owners removing each other cannot leave the workspace ownerless and records only the winning revocation. PostgreSQL row-lock/concurrency evidence remains required before treating the invariant as verified on the production database engine.
- 2026-11-08 AUTH-10 OAuth login state: persisted expiry must parse to a finite timestamp and must be later than the current time; malformed or expired values fail closed and are not consumed.
- 2026-11-08 SEC-11: Structured log redaction recognizes long-form GitHub credential prefixes `ghp_`, `ghs_`, `gho_`, `ghu_`, `ghr_`, and `github_pat_`; tokens must not be emitted as free-text log content. This is a local redaction control, not external sink configuration or monitoring evidence.
- Internal cron handlers require `Authorization: Bearer <CRON_SECRET>`. The four cron routes share byte-length-safe timing-resistant validation; missing/malformed credentials return a generic 401 before work or status data is accessed. Current local integration tests cover this contract, but do not verify deployment proxy/header behavior or configured live credentials.
- Bearer scheme comparison is case-insensitive; the credential value is still compared as UTF-8 bytes with a byte-length guard and timing-safe equality.
- In addition to per-operation limits, the harness rejects a scenario when the estimated sequential batch/retry timeout budget exceeds 60 seconds. This is input validation only; non-cooperative in-process callbacks are not forcibly terminated. Staging thresholds and worker-death recovery remain external gates.
