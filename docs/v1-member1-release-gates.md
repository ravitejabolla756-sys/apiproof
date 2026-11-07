# MY OWL V1 — Member 1 Release Gates

Last updated: 2026-11-07. This is a checklist, not a production approval.

| Gate | Status | Evidence / required next action |
|---|---|---|
| Clean isolated workstream baseline | PASS | `C:\YC-my-owl-v1-member1`, branch `codex/v1-backend-security`, reviewed from `d1cd9f4d`; current local implementation checkpoint `da11cdf` |
| Original dirty work preserved | PASS | Original `C:\YC-my-owl-v1` remains separate with 238 status entries |
| Dependency vulnerabilities | PASS (high/critical) | `pnpm audit --prod --audit-level=high` exits 0 after patched dependency updates; four moderate advisories remain (three Nodemailer, one minimatch) and require risk disposition |
| Security headers and exact-origin CORS | PASS (local) | Middleware tests cover protected API responses, approved/denied preflight, CSP, HSTS-on-HTTPS and OAuth-compatible popup policy; staging/browser smoke remains not tested |
| Scanner accuracy benchmark | PASS (curated) | `pnpm scanner:accuracy`: 24 fixtures, six supported adapters, TP 18/TN 6/FP 0/FN 0, precision/recall/version accuracy 1.0; limitations are explicit |
| Breaking-change classification | PASS (local) | PROV-05 compatibility/changelog, provider-registry, human-review and rescan suites pass 66/66; contradictory support/removal and semantic-change prose remain review-only with source evidence, and incomplete resource/API-version evidence remains `NEEDS_REVIEW` |
| Database source access inventory | PASS (local only) | `docs/v1-member1-db-access-matrix.md` inventories 40 tables and records RLS decisions, intended roles, catalog queries and blocked PostgreSQL isolation tests |
| PostgreSQL tenant isolation / RLS | BLOCKED | No approved production/staging role access; local SQLite tests are insufficient |
| PostgreSQL least-privilege grants | BLOCKED | No approved role/grant read-back environment |
| Auth/OAuth/session security | PARTIAL | 8-file auth/security matrix passed 70/70, including production missing-Origin/Referer CSRF rejection; email verification and unverified-account enforcement remain incomplete |
| Email verification backend flow | PASS (local only) | Migration 024, hashed single-use token service, verification/resend actions, verification page, and 8 focused tests pass; provider delivery and enforcement policy remain gated |
| Email verification delivery | BLOCKED | Approved email provider and Member 2 template contract not configured |
| GitHub App/webhook/private repository live verification | NOT_TESTED | No live credentials or authorized staging run in this workstream |
| Scanner/provider/impact accuracy | NOT_TESTED | Existing unit coverage; benchmark and adversarial acceptance work remains |
| Migration recommendations and sandbox | PARTIAL / EXTERNAL BLOCKED | Deterministic planner, bounded redacted context, strict model-output validation and isolated verification are locally covered; production AI provider/credentials/cost policy/runtime adapter are not approved |
| Finding lifecycle and resolution evidence | PASS (local only) | Migration 025, audited state transitions, workspace checks, idempotency/concurrency tests and completed-scan regression handling pass locally; live PostgreSQL/RLS and merged-SHA evidence remain unverified |
| Draft PR merge/rescan/resolution verification | PASS (local only) | PR-07/PR-08 focused webhook, async-worker and lifecycle suites pass; merge SHA is persisted, exact-commit rescan is durable/deduplicated, and resolution classifications/evidence are tenant-scoped; live GitHub/PostgreSQL execution remains unverified |
| RBAC and access revocation | PARTIAL / CONTRACT REVIEW | Current owner/member predicates remain; proposed revocation request/event, final-owner and session/job invalidation boundaries are documented; implementation awaits cross-member approval |
| Payment sandbox checkout/webhooks/lifecycle | BLOCKED | Current provider is `MockBillingProvider`; provider approval/credentials absent |
| Backup restore | BLOCKED | Requires approved isolated non-production backup/restore access |
| Error monitoring and alert routing | BLOCKED | Approved observability provider/destination absent |
| Queue/scheduler monitoring | PARTIAL | Worker registries/tables exist; metrics, alerts and failure rehearsal remain |
| Branch protection | BLOCKED | Requires GitHub repository-admin read-back and approval |
| Load/resilience evidence | NOT_TESTED | No safe reproducible harness/results yet |
| Deployment rollback rehearsal | BLOCKED | Hosting stack/staging rehearsal not authorized or verified |
| Retention/deletion | PARTIAL / POLICY BLOCKED | Account/workspace/billing/backup inventory and request-state contract are documented; legal retention policy and durable workflow remain unapproved |
| Final release security audit | NOT_TESTED | Must use a frozen candidate after all other gates |

## SEC-09 regression evidence

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS; Next.js 15.5.29, 63 static pages generated.
- Targeted backend/security tests: PASS, 7 files / 58 tests.
- Full `pnpm test` with process-scoped `APIPROOF_LOCAL_SEED_PASSWORD`: PASS, 157 passed files / 1 skipped (158 total); 1,327 passed tests / 4 skipped (1,331 total).
- Current PROV-05 seeded full-suite rerun: NOT_COMPLETE; the process remained active after bounded waiting and was stopped without an aggregate result. No full-suite pass is claimed for this checkpoint.
- IMP-09 focused regression suites: PASS, 3 files / 46 tests (`finding-lifecycle`, `proposal-recovery`, `phase4-async-scan-worker`); lifecycle acceptance includes transitions, duplicate/conflicting idempotency keys, concurrent retries, tenant mismatch, regression reopen and completed-scan evidence.
- PR-07/PR-08 focused regression suites: PASS, 3 files / 38 tests (`github-pull-request-webhook`, `finding-lifecycle`, `phase4-async-scan-worker`); coverage includes merge-SHA deduplication, missing-SHA rejection, persisted merge linkage, resolution classifications and idempotent evidence.
- The deterministic fixture stabilization uses repository-owned synthetic source for offline scan/verification tests plus committed LF rules for `evaluation/` and `evaluation-patches/`; no arbitrary local checkout is analyzed.

## Approval boundaries not crossed

- No production deployment, migration, DB write, live billing, real email, secret rotation, GitHub setting change, merge, or pull request was performed. The previously authorized development backup push created `origin/codex/v1-backend-security`; no production system was touched.
- Any live/staging gate above marked `BLOCKED` requires explicit owner authorization and external access before it can be verified.
