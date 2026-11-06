# MY OWL V1 — Member 1 Release Gates

Last updated: 2026-11-06. This is a checklist, not a production approval.

| Gate | Status | Evidence / required next action |
|---|---|---|
| Clean isolated workstream baseline | PASS | `C:\YC-my-owl-v1-member1`, branch `codex/v1-backend-security`, reviewed from `d1cd9f4d`; current local checkpoint `a269f5ed` |
| Original dirty work preserved | PASS | Original `C:\YC-my-owl-v1` remains separate with 238 status entries |
| Dependency vulnerabilities | PASS (high/critical) | `pnpm audit --prod --audit-level=high` exits 0 after patched dependency updates; four moderate advisories remain (three Nodemailer, one minimatch) and require risk disposition |
| Security headers and exact-origin CORS | PASS (local) | Middleware tests cover protected API responses, approved/denied preflight, CSP, HSTS-on-HTTPS and OAuth-compatible popup policy; staging/browser smoke remains not tested |
| Scanner accuracy benchmark | PASS (curated) | `pnpm scanner:accuracy`: 24 fixtures, six supported adapters, TP 18/TN 6/FP 0/FN 0, precision/recall/version accuracy 1.0; limitations are explicit |
| PostgreSQL tenant isolation / RLS | BLOCKED | No approved production/staging role access; local SQLite tests are insufficient |
| PostgreSQL least-privilege grants | BLOCKED | No approved role/grant read-back environment |
| Auth/OAuth/session security | PARTIAL | 8-file auth/security matrix passed 70/70, including production missing-Origin/Referer CSRF rejection; email verification and unverified-account enforcement remain incomplete |
| Email verification delivery | BLOCKED | Approved email provider and Member 2 template contract not configured |
| GitHub App/webhook/private repository live verification | NOT_TESTED | No live credentials or authorized staging run in this workstream |
| Scanner/provider/impact accuracy | NOT_TESTED | Existing unit coverage; benchmark and adversarial acceptance work remains |
| Migration sandbox and honest confidence | PARTIAL | Deterministic verification exists; approved AI provider is absent |
| Draft PR merge/rescan/resolution verification | PARTIAL | Local webhook/verification code exists; merged-SHA integration evidence remains |
| RBAC and access revocation | PARTIAL | Workspace predicates exist; complete revocation workflow and PostgreSQL tests remain |
| Payment sandbox checkout/webhooks/lifecycle | BLOCKED | Current provider is `MockBillingProvider`; provider approval/credentials absent |
| Backup restore | BLOCKED | Requires approved isolated non-production backup/restore access |
| Error monitoring and alert routing | BLOCKED | Approved observability provider/destination absent |
| Queue/scheduler monitoring | PARTIAL | Worker registries/tables exist; metrics, alerts and failure rehearsal remain |
| Branch protection | BLOCKED | Requires GitHub repository-admin read-back and approval |
| Load/resilience evidence | NOT_TESTED | No safe reproducible harness/results yet |
| Deployment rollback rehearsal | BLOCKED | Hosting stack/staging rehearsal not authorized or verified |
| Retention/deletion | PARTIAL | Policy and schema review incomplete; durable deletion workflow remains |
| Final release security audit | NOT_TESTED | Must use a frozen candidate after all other gates |

## SEC-09 regression evidence

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS; Next.js 15.5.29, 63 static pages generated.
- Targeted backend/security tests: PASS, 7 files / 58 tests.
- Full `pnpm test` with process-scoped `APIPROOF_LOCAL_SEED_PASSWORD`: PASS, 156 files / 1,310 tests / 4 skipped.
- The deterministic fixture stabilization uses repository-owned synthetic source for offline scan/verification tests plus committed LF rules for `evaluation/` and `evaluation-patches/`; no arbitrary local checkout is analyzed.

## Approval boundaries not crossed

- No production deployment, migration, DB write, live billing, real email, secret rotation, GitHub setting change, or remote push was performed.
- Any live/staging gate above marked `BLOCKED` requires explicit owner authorization and external access before it can be verified.
