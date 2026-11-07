# MY OWL V1 — Member 1 Release Gates

Last updated: 2026-11-08. This is a checklist, not a production approval.

| Gate | Status | Evidence / required next action |
|---|---|---|
| Clean isolated workstream baseline | PASS | `C:\YC-my-owl-v1-member1`, branch `codex/v1-backend-security`, reviewed from `d1cd9f4d`; current local implementation checkpoint `fa7d511` plus uncommitted generated `.codebase-memory/` only |
| Original dirty work preserved | PASS | Original `C:\YC-my-owl-v1` remains separate with 238 status entries |
| Dependency vulnerabilities | PASS (high/critical) | `pnpm audit --prod --audit-level=high` exits 0 after patched dependency updates; four moderate advisories remain (three Nodemailer, one minimatch) and require risk disposition |
| Security headers and exact-origin CORS | PASS (local) | Middleware tests cover protected API responses, approved/denied preflight, CSP, HSTS-on-HTTPS and OAuth-compatible popup policy; staging/browser smoke remains not tested |
| Scanner accuracy benchmark | PASS (curated) | `pnpm scanner:accuracy`: 24 fixtures, six supported adapters, TP 18/TN 6/FP 0/FN 0, precision/recall/version accuracy 1.0; limitations are explicit |
| Breaking-change classification | PASS (local) | PROV-05 compatibility/changelog, provider-registry, human-review and rescan suites pass 66/66; contradictory support/removal and semantic-change prose remain review-only with source evidence, and incomplete resource/API-version evidence remains `NEEDS_REVIEW` |
| Database source access inventory | PASS (local only) | `docs/v1-member1-db-access-matrix.md` inventories 40 tables and records RLS decisions, intended roles, catalog queries and blocked PostgreSQL isolation tests |
| PostgreSQL tenant isolation / RLS | BLOCKED | No approved production/staging role access; local SQLite tests are insufficient |
| PostgreSQL least-privilege grants | BLOCKED | No approved role/grant read-back environment |
| Auth/OAuth/session security | PARTIAL | Existing 8-file auth/security matrix passed 70/70; latest password-reset/email-verification/OAuth/CSRF run passes 39/39, including concurrent single-use token consumption; central unverified-account enforcement and PostgreSQL concurrency evidence remain incomplete |
| Email verification backend flow | PASS (local only) | Migration 024, hashed single-use token service, verification/resend actions, verification page, and 8 focused tests pass; provider delivery and enforcement policy remain gated |
| Email verification delivery | BLOCKED | Approved email provider and Member 2 template contract not configured |
| GitHub App/webhook/private repository live verification | NOT_TESTED | No live credentials or authorized staging run in this workstream |
| Scanner/provider/impact accuracy | NOT_TESTED | Existing unit coverage; benchmark and adversarial acceptance work remains |
| Migration recommendations and sandbox | PARTIAL / EXTERNAL BLOCKED | Deterministic planner, bounded redacted context, strict model-output validation and isolated verification are locally covered; production AI provider/credentials/cost policy/runtime adapter are not approved |
| Finding lifecycle and resolution evidence | PASS (local only) | Migration 025, audited state transitions, workspace checks, idempotency/concurrency tests and completed-scan regression handling pass locally; live PostgreSQL/RLS and merged-SHA evidence remain unverified |
| Draft PR merge/rescan/resolution verification | PASS (local only) | PR-07/PR-08 focused webhook, async-worker and lifecycle suites pass; merge SHA is persisted, exact-commit rescan is durable/deduplicated, and resolution classifications/evidence are tenant-scoped; live GitHub/PostgreSQL execution remains unverified |
| RBAC and access revocation | PARTIAL / CONTRACT REVIEW | Central owner/admin/member policy plus durable ORG-10 membership removal, idempotency, audit persistence and worker-time membership guards pass in local SQLite tests; ORG-05 unknown-role denial is covered across all five privileged provider-rule routes (3 files / 10 policy/route/tenant tests); Member 2's invitation/audit/service files are not integrated, and transactional invitation invalidation, migration reconciliation, PostgreSQL/RLS evidence and live worker verification remain open |
| Payment sandbox checkout/webhooks/lifecycle | BLOCKED | Local mock is explicitly disabled in production, requires an explicit sufficiently long test secret, validates normalized events, and exposes safe webhook/portal errors; 20 seeded local billing tests, typecheck, targeted ESLint and build pass. Provider approval/credentials and sandbox delivery/reconciliation evidence remain absent |
| Backup restore | BLOCKED | Requires approved isolated non-production backup/restore access |
| Error monitoring and alert routing | PARTIAL / EXTERNAL BLOCKED | Structured logger redacts common provider credential formats and sensitive credential fields; focused tests, typecheck, and full repository suite pass locally. Approved observability provider/destination, retention, alert thresholds/escalation, and staging rehearsal remain absent |
| Queue/scheduler monitoring | PARTIAL | Protected status exposes queue depth/age/retry/stalled-lease/exhaustion indicators and durable per-run worker/scheduler heartbeat outcomes; 12 focused heartbeat/cron tests cover failed/degraded outcomes, sanitized error codes, duplicate/cross-component completion, and missing-store behavior; alert destination/thresholds, confirmed scan-worker cadence and staged failure rehearsal remain |
| Branch protection | BLOCKED | Requires GitHub repository-admin read-back and approval |
| Load/resilience evidence | PARTIAL | Local-only SEC-16 harness covers bounded API, webhook, SQLite and worker-metrics workloads, cooperative timeout cancellation, injected sanitized failures and retry recovery/exhaustion; one Windows measurement snapshot is recorded in `docs/sec16-local-measurements.md`; approved staging traffic, SLOs, bottleneck and worker-failure-recovery evidence remain |
| Deployment rollback rehearsal | BLOCKED | Hosting stack/staging rehearsal not authorized or verified |
| Retention/deletion | PARTIAL / POLICY BLOCKED | Account/workspace/billing/backup inventory and request-state contract are documented; legal retention policy and durable workflow remain unapproved |
| Final release security audit | NOT_TESTED | Must use a frozen candidate after all other gates |

## SEC-09 regression evidence

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS; Next.js 15.5.29, 63 static pages generated.
- Targeted backend/security tests: PASS, 7 files / 58 tests.
- Full `pnpm test` with process-scoped `APIPROOF_LOCAL_SEED_PASSWORD`: PASS, 157 passed files / 1 skipped (158 total); 1,327 passed tests / 4 skipped (1,331 total).
- Latest seeded serial full-suite result after SEC-04 scheme-aware CSRF checks: PASS, 164 files passed / 1 skipped; 1,377 tests passed / 4 skipped (1,381 total), duration 933.70s. Auth/session/recovery/verification focused tests pass 4 files / 39 tests, typecheck and targeted ESLint pass, and `pnpm build` passes. A prior run had one CLI timeout at Vitest's 30s default; after aligning each real-process CLI test's outer timeout to the existing 120s child-process budget, the complete CLI file passed 10/10 and subsequent full runs pass. `proposal-recovery` passes in the suite with the process-scoped local seed. PostgreSQL/RLS and proxy/staging/production evidence remain unverified.
- SEC-16/ORG-05 targeted suite: PASS, 4 files / 26 tests; includes one load test covering four local workloads, two deterministic retry tests, three SQLite-backed ORG-05 tests, the pure role-policy tests, and existing multi-tenant workspace regressions.
- Targeted ESLint: PASS for the new SEC-16 and ORG-05 files; `pnpm typecheck`: PASS.
- 2026-11-08 billing boundary: PASS, 2 files / 20 tests with the process-scoped local seed; `pnpm typecheck`, targeted ESLint and `pnpm build` pass. This verifies only local mock rejection/normalization and SQLite transaction/idempotency behavior; provider-specific signature verification, sandbox delivery, PostgreSQL concurrency and production reconciliation remain blocked.
- Latest SEC-13 / SEC-16 checkpoint: PASS, 5 files / 31 tests, including the complete CLI contract file; targeted ESLint, `pnpm typecheck`, and `pnpm build` pass. The measurement record is local in-process evidence only; the subsequently completed full suite passes locally. Staging/production limits remain.
- ORG-10 service/authorization suite: PASS, 3 files / 12 tests; includes the 5 pure revocation-plan tests, 4 durable service tests and 3 role-policy integration tests. Coverage includes stale-session denial, preservation of another workspace, durable request/event records, duplicate/conflicting idempotency, final-owner/self-removal protection and concurrent removal serialization.
- The broader worker regression command (`proposal-recovery`, `slack-phase1`, `slack-reliability`) was stopped after a bounded wait without an aggregate result. It is recorded as `NOT_COMPLETE`; no assertions were weakened or bypassed.
- IMP-09 focused regression suites: PASS, 3 files / 46 tests (`finding-lifecycle`, `proposal-recovery`, `phase4-async-scan-worker`); lifecycle acceptance includes transitions, duplicate/conflicting idempotency keys, concurrent retries, tenant mismatch, regression reopen and completed-scan evidence.
- PR-07/PR-08 focused regression suites: PASS, 3 files / 38 tests (`github-pull-request-webhook`, `finding-lifecycle`, `phase4-async-scan-worker`); coverage includes merge-SHA deduplication, missing-SHA rejection, persisted merge linkage, resolution classifications and idempotent evidence.
- The deterministic fixture stabilization uses repository-owned synthetic source for offline scan/verification tests plus committed LF rules for `evaluation/` and `evaluation-patches/`; no arbitrary local checkout is analyzed.
- 2026-11-08 repository-connect authorization regression: PASS, `repositories-list-route` 5/5 with the required process-only SQLite seed; full `pnpm typecheck` and targeted ESLint pass. Cross-tenant membership denial is generic 403 and creates no repository row. This is local SQLite evidence, not PostgreSQL/RLS verification.
- 2026-11-08 SEC-16 harness label-bound regression: PASS, `sec16-load-resilience` 6/6; targeted ESLint and full `pnpm typecheck` pass. Scenario labels are bounded before execution; local workload measurements are not staging capacity or SLO evidence.
- SEC-16 local-only boundary regression: PASS, `sec16-load-resilience` now 7/7; production mode and configured remote database URLs are rejected before workload invocation. Targeted ESLint passes.
- SEC-10/SEC-19 document audit: `docs/database-backup-and-safety.md` now labels production backup/PITR/RPO/RTO and retention values as unverified proposals; no restore proof or legal retention approval is claimed. An approved isolated backup/restore rehearsal and legal/owner/Member 2 retention contract remain required.
- ORG-05 repository-list role regression: PASS, `repositories-list-route` 6/6 with process-only local seed; targeted ESLint and full `pnpm typecheck` pass. Unknown persisted roles receive generic 403 and private/no-store headers; this is SQLite-local evidence only.
- SEC-11 logger hardening: PASS, production-operations and Slack reliability suites 2 files / 28 tests with process-only local seed; targeted ESLint and full `pnpm typecheck` pass. Key-variant redaction and circular-context handling are local evidence; external monitoring remains unconfigured/unverified.

## Approval boundaries not crossed

- No production deployment, migration, DB write, live billing, real email, secret rotation, GitHub setting change, merge, or pull request was performed. The previously authorized development backup push created `origin/codex/v1-backend-security`; no production system was touched.
- Any live/staging gate above marked `BLOCKED` requires explicit owner authorization and external access before it can be verified.
