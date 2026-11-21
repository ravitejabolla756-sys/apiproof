# MY OWL V1 Autonomous Decision Log

Date: 2026-11-21
Candidate branch: `codex/v1-release-candidate`
Source candidate commit: `d24579471e80ee251afa23a7ce1ab23417204435`
Focused frontend correction commit: `af75a2bd`.
Pre-continuation branch/manifest commit: `c013494e04cd123da8a64ae40add294f66ecbb99`.
Application candidate commit: `f6f616ce9333f8f5f8c2283a4f996c4feb30b30b`.
Current branch HEAD and manifest SHA at verification start: `c67195363a6cd5eec82a25423ab63a8de8d7964e`.

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

Decision: **NO-GO for production launch.** The local release candidate is green at candidate HEAD `f6f616ce9333f8f5f8c2283a4f996c4feb30b30b`, but this is not production approval.

Reason: The local candidate is green, but the required external gates are unverified: hosted CI, disposable staging, PostgreSQL execution/RLS/grants, backup/restore, live provider credentials, rollback/observability, legal approval, billing readiness, and real GitHub/worker/Draft PR flows. The local release audit reports `NO_GO` with 40 unresolved tasks.

## FRONTEND-008 — Focused frontend correction

Decision: Port only four low-risk state/accessibility corrections from the frontend product snapshot and commit them as `af75a2bd`.

Evidence: The frontend audit confirmed the candidate already owns the current API contracts and core screens. The frontend snapshot additionally showed that its scan service/route removed tenant-context/session handling and active-scan protection, so a wholesale merge was rejected. The focused correction makes account settings honor `hasLocalPassword`, maps verification-policy errors, restores account feedback focus, and restores provider/dashboard retry, busy and live-region semantics without changing API calls or authorization.

Verification: Typecheck and lint passed; focused account/security/UX tests passed 12/12; the two environment-sensitive full-suite files passed 11/11 when rerun with elevated permissions.

## BROWSER-009 — Browser evidence boundary

Decision: Do not claim hosted or staging Playwright acceptance from the initial sandbox attempt.

Evidence: The initial disposable Playwright command stalled before test output because the sandbox denied local-port access. That evidence boundary was later re-tested with loopback access; see `BROWSER-012`.

## GATES-010 — Continuation release gates

Decision: Keep production status `NO_GO` after rerunning the release gates.

Evidence: Release audit remains `NO_GO` with 40 unresolved tasks; PostgreSQL is static-only; staging and backup/restore dry-runs are blocked; provider validation passes locally. No push, deployment, migration, billing activation or live Draft PR was performed.

## BUILD-011 — Network-enabled production build

Decision: Accept the network-enabled local production build as a local gate only.

Evidence: `pnpm build` completed successfully with the configured Inter, Newsreader and JetBrains Mono fonts when run with a disposable isolated Next output directory. Next-generated `next-env.d.ts` and `tsconfig.json` metadata changes were restored; the candidate worktree is clean. This does not replace hosted CI.

## BROWSER-012 — Disposable local browser verification

Decision: Accept local browser verification while keeping hosted/staging acceptance open.

Evidence: `pnpm test:e2e` passed 28/28 tests in 6.4 minutes on loopback port `3117` using disposable SQLite state. Coverage included authenticated account settings, dashboard navigation and responsive behavior, public-route regression and axe audits. No hosted deployment or production service was contacted.

## HOSTED-013 — Publication evidence boundary

Decision: Keep hosted CI and staging unevaluated until the candidate is explicitly published through the authorized non-production path.

Evidence: GitHub has no remote `v1-release-candidate` branch, no candidate commit `f6f616ce`, no workflow runs and no combined status for that SHA. Vercel read-only inventory contains only older `main` deployments for the repository, not this candidate. No push, deployment or staging execution was performed.

## HOSTED-014 — Final trigger and launch decision

Decision: Do not publish or alter the CI trigger configuration without owner authorization; keep the November 28, 2026 launch **NO-GO**.

Evidence: The existing CI has no `workflow_dispatch`; it is scoped to pushes on `main`/`codex/v1-integration` and pull requests targeting `main`. Its jobs are frozen install, audit, lint, typecheck, provider validation, Vitest, build, release manifest and disposable PostgreSQL tests, with read-only repository permissions. It has no deployment or migration step. GitHub read-only checks show no candidate branch/SHA/checks, and Vercel has no candidate deployment. Local Playwright is green, but executable PostgreSQL, staging/rollback, backup/restore, live GitHub, provider and operational/legal evidence remain open.
