# MY OWL V1 Autonomous Decision Log

Date: 2026-11-21
Candidate branch: `codex/v1-release-candidate`

## BASELINE-001 — Immutable development baseline

Decision: Use `267c0d7b23fb80f7861ffeeafe470984edf5293e` from `codex/my-owl-v1-development` as the release-candidate base.

Reason: It is the current development head and contains the newer tenant-authorized scan, email-verification, and concurrency work. The source checkout is dirty, so all integration work is isolated in a managed candidate worktree.

Safety: No reset, cleanup, force-push, main merge, deployment, or production write was performed.

## INTEGRATION-002 — Selective integration baseline

Decision: Merge `codex/v1-integration` at `11639a48236b88364bf95a1d8506286aeb91a2d9` inside the isolated candidate and resolve conflicts there.

Reason: The integration branch supplies the broader V1 contract, security documentation, workspace/account surfaces, provider evidence, test coverage, and CI/release scripts. It overlapped 19 critical files, so a blind merge was rejected.

Outcome: Integration behavior was retained where compatible; current development contracts were restored where integration contained stale founder-only or migration-history assumptions.

## SECURITY-003 — Tenant-authorized live scans

Decision: Preserve tenant/workspace/repository authorization and remove only the stale global founder-owner filter. Keep `APIPROOF_ENABLE_LIVE_GITHUB` fail-closed.

Reason: The current P0 contract explicitly enables live scanning without a global founder identity and requires push processing for connected repositories in every authorized workspace. A founder-only global identity would break the multi-tenant contract.

Controls retained: CSRF, authenticated and verified users, repository access checks, active lifecycle, active GitHub installation association, webhook HMAC, delivery idempotency, workspace/repository consistency checks, bounded worker batches, lease recovery, and safe failure categories.

## WORKER-004 — Bounded cross-workspace worker

Decision: Allow the authenticated internal worker to drain a bounded batch across workspaces; do not require a caller-supplied repository ID for every batch.

Reason: Queue rows carry workspace and repository identity, and each claimed job is checked against its repository and active installation before source fetch. The P0 contract and scheduled-worker design require bounded multi-tenant draining.

Controls retained: internal worker authentication, live-scan flag, batch/timeout limits, claim leases, workspace/repository mismatch rejection, and active/suspended installation handling.

## MIGRATION-005 — Email verification migration history

Decision: Leave `emailVerificationMigrations` unregistered at migration ID `024` until the existing `024–027` production history is reconciled with owner-approved evidence.

Reason: Registering a second `024` or moving it to `029` without production history proof risks replaying or misordering schema changes. Local SQLite initialization is idempotent and tests now use it instead of manually adding the column.

Impact: Production email-verification migration remains an explicit external blocker; no production database mutation was attempted.

## TEST-006 — Verification gates

Decision: Require passing typecheck, lint, focused security/integration tests, and the full local suite before committing the candidate.

Evidence: Typecheck PASS; lint PASS; focused suite PASS (10 files, 99 tests); full suite PASS (207 files, 1,602 passed, 3 skipped, 16 skipped tests, 19 todo).

## RELEASE-007 — Production decision

Decision: **NO-GO for production launch.**

Reason: The local candidate is green, but the required external gates are unverified: hosted CI, disposable staging, PostgreSQL execution/RLS/grants, backup/restore, live provider credentials, rollback/observability, legal approval, billing readiness, and real GitHub/worker/Draft PR flows. The local release audit reports `NO_GO` with 40 unresolved tasks.
