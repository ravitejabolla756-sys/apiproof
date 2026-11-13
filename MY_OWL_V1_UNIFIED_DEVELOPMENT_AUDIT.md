# MY OWL V1 Unified Development Audit

Date: 2026-11-13
Repository: `https://github.com/ravitejabolla756-sys/apiproof`
Audit type: read-only checkpoint; no application implementation was changed and no commit, push, merge, rebase, deployment, provider activation, or database operation was performed.

## Executive result

**Release decision: NO-GO.** The combined branch has substantial locally verified source functionality, but it is not production-verified. The remaining gates include unresolved migration history 024–027, real PostgreSQL RLS/grants and concurrency evidence, backup/restore rehearsal, provider and legal approvals, hosted CI/staging evidence, unresolved Member 2 browser failures, and the unavailable Member 2 handoff commit `f41bacfdb003d918fa043d4d848287b8304fc97a`.

## A. Actual Git state

### Repository and worktrees

- Audit command context: `C:\YC-my-owl-v1`; requested integration worktree: `C:\YC-my-owl-v1-integration-v2`.
- Integration repository root: `C:\YC-my-owl-v1-integration-v2`.
- Integration branch/HEAD: `codex/v1-integration` / `ebb4fac20712e2dd2486468d705f4f19f1811348`.
- Member 1 branch/HEAD: `codex/v1-backend-security` / `bbfe3309a4f788d272966cb0b9596fb683dfbf7d`.
- Member 2 Windows branch/HEAD: `codex/v1-frontend-product` / `9460b47b40aed976917ac268dbdff575c6376a1c`.
- Original worktree: `C:\YC-my-owl-v1`, branch `codex/my-owl-v1-development`, HEAD `d1cd9f4d90f574b8ab647c9852ec38261e83b6f8`.
- Older preparation worktree: `C:\YC-my-owl-v1-integration`, branch `codex/v1-migration-compatibility-prep`, HEAD `97f8343ae3f20d120abaec62d53d34a53f8a61c6`.
- Additional worktrees exist under `C:\YC` for provider, OAuth, homepage and worker work; none were modified by this audit.

### Remote references after read-only fetch

| Ref | Exact hash |
|---|---|
| `origin/main` | `2d63d80d8a5c64f7f4547f70f7e0e0598d60f194` |
| `origin/codex/v1-backend-security` | `bbfe3309a4f788d272966cb0b9596fb683dfbf7d` |
| `origin/codex/v1-frontend-product` | `f4913d0707fae91c662813f3171a2bb9fa03bf2c` |
| `origin/codex/v1-integration` | `fbee1d7f5d3fb9f8f562cbc61c2a5921e7d0fea8` |

Origin is `https://github.com/ravitejabolla756-sys/apiproof.git` for fetch and push. The fetch was read-only; no remote state was changed.

### Divergence and dirty state

| Worktree | Status |
|---|---|
| Original `C:\YC-my-owl-v1` | **Dirty: 238 entries** including application/evaluation files and untracked `.gitattributes`, `MY_OWL_V1_DEVELOPMENT_BASELINE.md`, and `MY_OWL_V1_TEST_STABILIZATION_REPORT.md`. Preserved untouched. |
| Member 1 | Clean tracked tree; untracked `.codebase-memory/` and `docs/v1-member1-org10-integration.md`. |
| Member 2 | Modified `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`; untracked `test-results/`. Preserved untouched. |
| Older integration preparation | Modified `apps/web/tsconfig.json`. Preserved untouched. |
| Current integration | Modified `.github/workflows/ci.yml`, `apps/web/scripts/release-manifest.ts`, `packages/shared/package.json`, `tests/ci-workflow-contract.test.ts`; untracked `docs/mig-01-integration-decision.md`. No staged files. |

The integration branch is **9 commits ahead** of `origin/codex/v1-integration` and has no commits behind it (`0 9` for `origin...HEAD`). It is **51 commits ahead** of `origin/main` and has no commits behind it. Member 1 local and remote are identical. Member 2's Windows worktree is at `9460b47`; its remote tracking branch is `f4913d07`, and the worktree has not been treated as a clean synchronized handoff.

### Integration-only commits not on the remote integration ref

`ebb4fac2`, `e1b787c5`, `f0d41031`, `0fef5899`, `ad9a6810`, `2d5f1d41`, `d295787e`, `c818d793`, and `6383601c`. These remain local; this audit did not push them.

### Member 2 synchronization

`f41bacfdb003d918fa043d4d848287b8304fc97a` was checked by object/ref reachability and is not available on this Windows checkout or the fetched GitHub refs. **MEMBER_2_HANDOFF_NOT_SYNCHRONIZED.** The current remote checkpoint is `f4913d0707fae91c662813f3171a2bb9fa03bf2c`, and the local Windows worktree is `9460b47b40aed976917ac268dbdff575c6376a1c`.

## B. Member 1 task register — 27 entries

Status describes the combined integration branch unless explicitly stated otherwise. `PRODUCTION_VERIFIED` count is zero.

| ID | Status | Existing/source evidence | Integration evidence | Missing acceptance/dependency | Exact next action |
|---|---|---|---|---|---|
| SEC-04 | INTEGRATED_PARTIAL | CSRF, origin and rate-limit source/tests exist. | Security middleware and auth regressions are present; current focused set passed. | Full route matrix, hosted proxy behavior and Postgres/session evidence. | Run the complete state-changing route matrix and obtain hosted evidence. |
| SEC-08 | INTEGRATED_VERIFIED_LOCAL | Security-header implementation and tests. | `tests/security-headers.test.ts`; current build/typecheck passed. | Hosted header and deployment verification. | Verify headers on an approved nonproduction deployment. |
| SEC-09 | INTEGRATED_VERIFIED_LOCAL | Dependency policy/audit tooling and locked dependency checks. | Integration contains dependency policy; local focused dependency test passed. | Current registry advisory refresh and hosted CI execution. | Run the current advisory scan with approved network access and record findings. |
| SEC-15 | INTEGRATED_PARTIAL | Hardened workflow and workflow-contract tests. | Workflow files are currently dirty in integration; local contract evidence exists. | GitHub-hosted run, permissions, branch protection and fork-secret review. | Review the dirty workflow diff, validate YAML, then run hosted CI after approval. |
| SEC-16 | INTEGRATED_VERIFIED_LOCAL | Bounded load/resilience harness and deterministic failure scenarios. | Commit `0fef5899`; focused suite included 13/13 files with 100 passed tests and 18 todo. | Staging capacity, autoscaling and recovery evidence. | Execute an owner-approved staging rehearsal with bounded workload. |
| SCAN-12 | INTEGRATED_PARTIAL | Multi-language scanner/detector work and C# package fix `6383601c`. | Scanner code is present, but no fresh dedicated scanner-only run was completed in this audit. | Full fixture matrix, path-safety proof and schema-backed persistence. | Run scanner positive/negative/path-safety suites and record evidence. |
| PROV-05 | INTEGRATED_VERIFIED_LOCAL | Provider identifiers, conservative compatibility and source-provenance rules. | Commit `c818d793`; local provider-focused evidence exists. | Fresh live provider sources and stale-source acceptance. | Run current compatibility/provenance suite and arrange approved refresh. |
| IMP-09 | INTEGRATED_VERIFIED_LOCAL | Finding lifecycle and resolution guards. | Commit `d295787e`; finding lifecycle tests passed in focused suite. | Real schema-compatible persistence and independent scan evidence. | Validate on an approved disposable PostgreSQL schema. |
| PR-07 | INTEGRATED_VERIFIED_LOCAL | Signed webhook verification, deduplication and event classification. | Commit `2d5f1d41`; webhook tests passed locally. | GitHub App permissions, live signed delivery and hosted callback evidence. | Obtain an isolated GitHub App sandbox and run signed delivery acceptance. |
| PR-08 | INTEGRATED_VERIFIED_LOCAL | Resolution worker/reconciliation guard. | Commit `ad9a6810`; worker/resolution tests passed locally. | PostgreSQL finding schema and queue rehearsal. | Run worker integration tests against approved disposable PostgreSQL. |
| AUTH-05 | BLOCKED_EXTERNAL | Token lifecycle logic and provider-neutral delivery boundary. | Decision documentation exists; live delivery remains disabled. | Approved email provider, sender verification, credentials, templates, retention and DB proof. | Obtain owner/provider approval, then test a sandbox transport. |
| AUTH-10 | INTEGRATED_PARTIAL | Verified-user policy boundary in `f0d41031`. | Commit `f0d41031`; policy tests passed and account browser baseline passed. | Complete protected-route rollout, OAuth acceptance and PostgreSQL concurrency. | Inventory every protected route and gate from server-derived state. |
| ORG-05 | INTEGRATED_PARTIAL | Workspace policy and role matrix. | Commit `e1b787c5`; authorization-focused tests passed. | PostgreSQL RLS/grants and Member 2 invitation/audit schema contracts. | Complete role matrix on disposable PostgreSQL and reconcile contracts. |
| ORG-10 | INTEGRATED_PARTIAL | `buildMemberRevocationPlan`, scoped revocation and error mapper. | Commit `ebb4fac2`; 20 passed and 18 todo in organization contract/revocation coverage. | Member 2 route, invitations, audit persistence and PostgreSQL concurrency. | Integrate only after schema/route compatibility review and test concurrency. |
| MIG-01 | BLOCKED_EXTERNAL | Draft recommendation/patch safety interfaces and offline policy. | Decision documentation only; no external model enabled. | Model/provider, data handling, budget and owner approval. | Approve provider/policy, then run offline fixtures before any sandbox call. |
| BILL-02 | INTEGRATED_PARTIAL | Provider-neutral billing/checkout abstraction and Free Beta gate. | Local authorization and checkout blocking are present. | Provider selection, merchant/tax/currency policy and sandbox credentials. | Obtain provider decision and execute adapter sandbox tests. |
| BILL-03 | INTEGRATED_PARTIAL | Fail-closed webhook boundary and duplicate-delivery concepts. | Local billing security regressions exist; no live provider signature contract. | Exact provider algorithm, raw-body contract, secret and sandbox evidence. | Select provider then bind exact signature fixtures. |
| BILL-04 | INTEGRATED_PARTIAL | Provider-neutral lifecycle state handling. | Local state/authorization tests exist. | Provider mapping, ledger schema and PostgreSQL concurrency. | Approve event mapping and test out-of-order sequences in isolated Postgres. |
| BILL-10 | BLOCKED_EXTERNAL | Entitlement/Free Beta protections and policy boundary. | Checkout remains gated; no unapproved suspension behavior enabled. | Legal/business grace, suspension, notice and continuity policy. | Obtain written policy approval and implement only approved transitions. |
| SEC-01 | BLOCKED_EXTERNAL | Static RLS design and read-only evidence templates. | No real PostgreSQL RLS acceptance. | Approved isolated PostgreSQL, schema history and effective-policy evidence. | Run cross-tenant isolation suite on approved disposable PostgreSQL. |
| SEC-02 | BLOCKED_EXTERNAL | Role/grant assertions and least-privilege design. | No effective grant proof from PostgreSQL. | Isolated roles, grants, ownership and credential-handling evidence. | Capture `current_user`/effective grants in a disposable cluster. |
| SEC-10 | BLOCKED_EXTERNAL | Backup/restore rehearsal procedure and decision document. | Dry-run/documentation only. | Approved backup source, isolated restore target and owner RPO/RTO. | Execute and measure an authorized end-to-end restore rehearsal. |
| SEC-11 | BLOCKED_EXTERNAL | Redaction, health and local telemetry contracts. | Local no-op/metrics tests exist; no hosted monitoring. | Provider, retention, alert destinations and privacy owner decisions. | Approve telemetry policy and verify nonproduction alerts. |
| SEC-13 | INTEGRATED_PARTIAL | Queue metrics, retry/dead-letter and fault scenarios. | Local fault/metrics tests passed where included. | Thresholds, worker/Postgres rehearsal and hosted alert evidence. | Run bounded worker fault rehearsal with approved disposable Postgres. |
| SEC-17 | BLOCKED_EXTERNAL | Read-only staging checklist and rollback dry-run design. | No hosted staging execution. | Hosting owner, staging project, DB clone, rollback window and approvals. | Obtain staging authorization and execute dry-run/rehearsal. |
| SEC-19 | BLOCKED_EXTERNAL | Deletion inventory/dry-run planning and account lifecycle boundaries. | Destructive action remains unavailable. | Legal retention, deletion exceptions, backup and owner approval. | Approve retention policy and test a non-destructive deletion plan. |
| SEC-20 | NOT_IMPLEMENTED | Release-audit criteria are documented. | No final integrated audit or GO evidence. | All prior gates, artifacts, hosted/staging and owner signoffs. | Run only after every prerequisite evidence package is complete. |

## C. Member 2 task register — 26 entries

Member 2's source documentation reported 4 locally verified, 21 partial and 1 blocked. The current integration status below is deliberately separate: most Member 2 source work has not been incorporated into `codex/v1-integration`, and the reported `f41bacf` handoff is unavailable.

| ID | Status | Source-branch evidence | Combined integration evidence | Missing acceptance/dependency | Exact next action |
|---|---|---|---|---|---|
| AUTH-08 | INTEGRATED_VERIFIED_LOCAL | Member 2 docs: DONE_VERIFIED_LOCAL. | Account settings flow and Playwright account tests passed 3/3 locally. | Hosted OAuth/real Postgres and complete route inventory. | Re-run full auth/browser matrix after synchronized handoff. |
| AUTH-09 | BLOCKED_EXTERNAL | Member 2 docs: BLOCKED. | No destructive deletion enabled. | Legal retention and deletion contract; overlaps SEC-19. | Keep unavailable until legal and recovery gates pass. |
| UI-12 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Shared dashboard UI exists, but full product acceptance is incomplete. | Complete route coverage and synchronized source handoff. | Reconcile dashboard components and route matrix. |
| UI-13 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Account/invoice browser flows pass locally; four reported dashboard/permission failures remain unresolved. | Full browser, responsive and accessibility acceptance. | Reproduce each failing browser flow with diagnostics. |
| ORG-02 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Some workspace functionality exists in integration. | Final organization schema and ownership contract. | Compare source route/service contracts after handoff sync. |
| ORG-03 | SOURCE_ONLY | Member 2 docs: PARTIAL invitation work. | No authoritative invitation migration integrated; migration 024 collision remains. | Migration identity and transactional invitation design. | Integrate only after migration evidence and contract review. |
| ORG-04 | SOURCE_ONLY | Member 2 docs: PARTIAL member-management work. | No complete combined route acceptance. | ORG-10 delegation, role and audit compatibility. | Review route against Member 1 revocation adapter. |
| ORG-11 | SOURCE_ONLY | Member 2 docs: PARTIAL organization UI/permissions. | Not accepted in combined branch. | Final API/error/audit contract. | Add contract tests after synchronized source is available. |
| BILL-07 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Billing gate/authorization behavior exists locally. | Provider and subscription ownership evidence. | Reconcile plans and workspace authorization. |
| BILL-08 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Portal boundary exists but provider is unavailable. | Approved provider and sandbox. | Bind portal behavior after provider selection. |
| BILL-09 | INTEGRATED_PARTIAL | Member 2 docs: MISSING. | Invoice API/UI unavailable-state journey passes 2/2 locally. | Real provider invoice mapping and data contract. | Integrate provider-backed history only after BILL-02/03 approval. |
| BILL-11 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No complete combined lifecycle acceptance. | Provider mapping and ledger schema. | Reconcile with BILL-04 state machine. |
| NOT-01 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No complete combined notification delivery. | Event schema and delivery provider. | Define shared event contract first. |
| NOT-02 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No combined preference acceptance. | Notification preference migration 025 collision. | Resolve migration identity then integrate. |
| NOT-03 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No combined email acceptance. | Email provider and template approval. | Reuse AUTH-05 delivery boundary. |
| NOT-04 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No combined in-app notification acceptance. | Shared event/persistence schema. | Add schema-independent presentation tests. |
| NOT-05 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No digest scheduler acceptance. | Scheduler endpoint, secrets and thresholds. | Repair workflow environment contract safely. |
| NOT-06 | SOURCE_ONLY | Member 2 docs: DONE_VERIFIED_LOCAL. | Source-local evidence only; not integrated acceptance. | Cross-branch event compatibility and hosted scheduler evidence. | Revalidate after source handoff is synchronized. |
| NOT-10 | BLOCKED_EXTERNAL | Member 2 docs: BLOCKED. | No external delivery/alert acceptance. | Provider, legal notice and monitoring decisions. | Keep blocked pending approvals. |
| WEB-08 | INTEGRATED_PARTIAL | Member 2 docs: DONE_VERIFIED_LOCAL. | Public product surface exists, but no current full public-site audit. | Full route/visual/accessibility evidence. | Run public-site regression set. |
| WEB-11 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Partial dashboard/navigation surface. | Full responsive and browser evidence. | Resolve outstanding dashboard browser failures. |
| WEB-12 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Partial public/product content. | Content/source handoff verification. | Confirm latest messaging commit availability first. |
| WEB-13 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Partial responsive experience. | Mobile widths and accessibility evidence. | Run responsive browser matrix. |
| WEB-14 | INTEGRATED_PARTIAL | Member 2 docs: DONE_VERIFIED_LOCAL. | Source-local evidence only. | Combined branch and hosted link verification. | Re-run after synchronized source comparison. |
| WEB-15 | INTEGRATED_PARTIAL | Member 2 docs: PARTIAL. | Partial navigation/error handling. | Full dashboard route coverage. | Fix and verify the four unresolved browser failures. |
| SEC-18 | SOURCE_ONLY | Member 2 docs: PARTIAL. | No combined acceptance. | Security/a11y evidence and source synchronization. | Review security surface after Member 2 handoff is available. |

## D. Combined integrated application status

| Area | Classification | Evidence and limitation |
|---|---|---|
| Authentication/OAuth | INTEGRATED_PARTIAL | Local account flow and policy tests pass; hosted Google/GitHub and Postgres concurrency are not verified. |
| Account settings | INTEGRATED_VERIFIED_LOCAL | Playwright account suite: 3 passed; not production verified. |
| Repository connections | SOURCE_ONLY | Member 2 source/feature status is not a synchronized combined acceptance; one known browser timeout remains. |
| Scanning engine | INTEGRATED_PARTIAL | Scanner/finding code exists; complete runtime scan persistence and current fixture matrix still require verification. |
| Provider intelligence | INTEGRATED_VERIFIED_LOCAL | Conservative analyzer/provenance behavior has local evidence; live freshness is pending. |
| Findings lifecycle | INTEGRATED_VERIFIED_LOCAL | Local policy/worker tests pass; schema-backed and hosted queue evidence is pending. |
| Migration recommendations | BLOCKED_EXTERNAL | AI provider, cost, data-handling and review approvals absent. |
| Draft PR generation | INTEGRATED_VERIFIED_LOCAL | Local signed-event/draft constraints tested; live GitHub App evidence absent. |
| GitHub webhooks | INTEGRATED_VERIFIED_LOCAL | Signed fixture behavior tested; no live GitHub App delivery acceptance. |
| Organization management | INTEGRATED_PARTIAL | Revocation and policy boundaries exist; Member 2 invitation/audit integration is not complete. |
| Invitations/permissions | SOURCE_ONLY | Member 2 invitation source is not safely integrated; migration 024 conflict remains. |
| Billing/invoices | INTEGRATED_PARTIAL | Authorization and unavailable invoice journey pass locally; provider lifecycle is gated. |
| Notifications/digests | SOURCE_ONLY | Member 2 work is not synchronized/integrated; provider/scheduler gates remain. |
| Dashboard/navigation | INTEGRATED_PARTIAL | Local account/invoice flows pass; four reported dashboard/permission browser failures remain unresolved. |
| Public website | INTEGRATED_PARTIAL | Product surface exists; current full content/responsive/accessibility acceptance is incomplete. |
| Responsive design | INTEGRATED_PARTIAL | Account mobile test passed; broader dashboard/mobile matrix is incomplete. |
| Browser testing | INTEGRATED_PARTIAL | Current invoice/account run: 5 passed; reported Member 2 failures remain unresolved. |
| Security protections | INTEGRATED_PARTIAL | Headers, CSRF/rate limits and policy tests are locally covered; hosted/Postgres evidence absent. |
| PostgreSQL/migrations | BLOCKED_EXTERNAL | Migration guard is fail-closed, but no approved database-history or real PostgreSQL RLS/grant evidence exists. |
| Monitoring/infrastructure | BLOCKED_EXTERNAL | Local telemetry/resilience exists; hosted provider, alerting, staging and restore evidence absent. |

## E–I. Remaining implementation and acceptance blockers

### Source-only or incomplete code

The highest-impact source-only areas are Member 2 organization invitations/member management, notification and digest delivery, repository/dashboard paths, and the unsynchronized public product messaging handoff. These cannot be safely consolidated from a missing `f41bacf`; do not recreate teammate changes from a SHA description.

### Backend-dependent frontend features

Invitation screens, organization membership management, billing portal/subscription states, invoice history with real provider data, notifications/digests, repository/scan dashboards, account deletion and migration recommendations all depend on backend contracts, schema compatibility, provider approval or synchronized source. UI presence is not acceptance evidence.

### Incomplete tests and known failures

- Current focused integration run: **13 test files passed, 100 tests passed, 18 todo, 0 failed**. The todo cases are principally contract/provider/PostgreSQL/Member 2 integration gates; they are not acceptance passes.
- `pnpm typecheck`: passed for the workspace/test projects.
- Targeted ESLint: passed with `--max-warnings 0` for the changed security/integration surfaces.
- `pnpm -r build`: passed locally, but generated Next config files were restored after the run; the current integration status intentionally excludes those generated edits.
- Playwright `tests/e2e/invoice-history.integration.spec.ts tests/e2e/account-settings.integration.spec.ts`: **5 passed** locally using disposable SQLite and test-only credentials.
- Member 2's reported failures remain unresolved: `/dashboard/migrations` timeout, `/dashboard/repositories` timeout, `/dashboard/inventory` timeout, and workspace permission-denied assertion timeout.
- Historical Member 2 full-suite evidence: 1322 passed, 1 failed external-fixture line mismatch, 4 skipped; this is source documentation, not current combined evidence.
- No current full repository Vitest run, hosted GitHub Actions run, real PostgreSQL RLS/grant/concurrency run, staging run, or end-to-end provider run was claimed.

### Migration compatibility blocker

Migration IDs 024–027 have independent meanings on the two source branches:

| ID | Member 1 | Member 2 |
|---|---|---|
| 024 | `email_verification_migration.ts` / email verification | `organization-migration.ts` / workspace invitations and audit events |
| 025 | `finding-lifecycle-migration.ts` / finding lifecycle | `notification-migration.ts` / user notification preferences |
| 026 | `finding-resolution-migration.ts` / resolution verification | `email-delivery-migration.ts` / email delivery ledger |
| 027 | `member-revocation-migration.ts` / workspace revocation | `scan-failure-notification-migration.ts` / Slack delivery |

The integration branch's `validateMigrationHistory` guard fails closed and currently registers only the Member 1 member-revocation migration among these colliding ranges. No migration was renamed, replayed, applied or disabled. Required evidence is the complete sanitized `_apiproof_migrations` ledger, engine/version, schema fingerprints, constraints/indexes, partial-application indicators and provenance from approved isolated database copies for fresh, Member 1 legacy, Member 2 legacy and mixed histories. Owner approval is required before any compatibility map or forward-only numbering scheme is selected.

### External/provider/legal blockers

Required decisions/evidence include: approved AI model/provider and budget; email provider/domain/templates and bounce policy; billing provider, merchant/tax/currency/plan/refund policy and sandbox credentials; real PostgreSQL roles/RLS/grants/concurrency; backup source, restore target and RPO/RTO; monitoring provider, retention and alert ownership; staging deployment/rollback authorization; legal deletion/retention policy; GitHub App permissions and webhook host; and hosted CI/branch-protection verification.

## J. Ten additional product features

These are separate from the 53 original task entries and are not double-counted.

| # | Feature | Status | Evidence/overlap | Safe immediate action |
|---|---|---|---|---|
| 1 | GitHub pre-merge PR checks/comments | PARTIAL | SEC-15/PR-07 cover workflow and webhook foundations; full comment automation is not accepted. | Harden/test workflow and signed event contracts. |
| 2 | Finding dismiss/ignore/snooze | ABSENT | No accepted combined implementation found; related to IMP-09 but not equivalent. | Define state/audit semantics before coding. |
| 3 | Per-repository configuration | PARTIAL | Repository/provider surfaces exist in source; full combined UI/API acceptance is missing. | Inventory actual route and persistence contract. |
| 4 | Guided onboarding | PARTIAL | Auth/dashboard flows exist; no complete guided onboarding acceptance. | Create a route-by-route browser specification. |
| 5 | Public provider/rule coverage directory | PARTIAL | Provider coverage/analyzer work exists; public directory acceptance is incomplete. | Verify public route, freshness and accessibility. |
| 6 | Data export and deletion | BLOCKED | SEC-19/AUTH-09 deletion and legal retention gates; export not accepted. | Approve legal data inventory and build dry-run only. |
| 7 | Two-factor authentication | ABSENT | No accepted combined implementation/evidence found. | Define threat model and provider/storage contract. |
| 8 | Internal admin/support tools | ABSENT | No accepted admin/support surface found. | Define least-privilege scope and audit requirements. |
| 9 | Product analytics/error tracking | PARTIAL | SEC-11 local telemetry/redaction exists; hosted provider and retention absent. | Approve provider/privacy policy and test no-PII events. |
| 10 | Findings CSV/PDF export | ABSENT | No accepted combined export route/evidence found. | Specify authorization, pagination and export retention. |

## K. Top 20 engineering actions

1. Synchronize and verify Member 2's actual handoff; obtain the missing `f41bacf` from the owner if still required.
2. Preserve the current dirty worktrees and create a clean evidence snapshot without deleting artifacts.
3. Resolve migration 024–027 using approved isolated database ledger/schema evidence.
4. Reconcile the actual Member 2 invitation/audit schema with ORG-10.
5. Run ORG-05 RLS/grant and cross-tenant tests on disposable PostgreSQL.
6. Complete ORG-10 PostgreSQL concurrency and invitation invalidation tests.
7. Reproduce the four outstanding Member 2 browser failures with network/console traces.
8. Audit every protected route against the verified-user policy boundary.
9. Run the current dependency advisory scan and record advisory findings.
10. Validate SEC-15 workflow YAML, permissions, fork boundaries and hosted CI.
11. Execute scanner fixture/path-safety regressions.
12. Validate finding lifecycle/worker persistence against an unambiguous disposable schema.
13. Approve a billing provider and run sandbox checkout/webhook/lifecycle sequences.
14. Obtain email provider/domain approval and run sandbox verification delivery.
15. Approve and test deletion/retention dry-run behavior without destructive execution.
16. Execute backup/restore rehearsal and measure actual recovery evidence.
17. Approve monitoring/alert thresholds, retention and escalation ownership.
18. Execute staging deployment/rollback rehearsal only after all release gates pass.
19. Finish missing frontend notification, repository, organization and billing paths from synchronized source.
20. Run SEC-20 only after all artifacts, hosted checks and owner signoffs are traceable.

## L. Independently executable work packages

1. **Evidence synchronization:** obtain Member 2's exact source checkpoint and make a clean read-only inventory.
2. **Migration evidence:** collect sanitized ledger/schema fingerprints from approved isolated copies; no migration execution.
3. **PostgreSQL security:** disposable RLS/grant/concurrency harness with no production credentials.
4. **Browser reliability:** diagnose the four dashboard/permission timeouts without weakening auth.
5. **Security local verification:** complete SEC-04/08/09/15 route, workflow and advisory checks.
6. **Scanner/finding local verification:** run fixture, path-safety, lifecycle and worker suites.
7. **Provider approval packets:** prepare decision matrices and offline adapters for email, billing and AI.
8. **Operations readiness:** dry-run backup/restore, staging/rollback, monitoring and alert evidence.
9. **Frontend source integration:** after synchronization, integrate one route slice at a time with API/browser tests.
10. **Final release audit:** SEC-20 traceability and GO/NO-GO only after all gates.

## M. GO/NO-GO

**NO-GO for production and for destructive integration against existing databases.** It is safe to continue isolated source-only development and read-only evidence preparation. It is not safe to claim V1 acceptance, activate billing/email/AI, run migrations on existing databases, perform account deletion, or deploy.

## 2026-11-13 milestone — dashboard browser reliability

Implemented in the integration worktree:

- Extended `tests/e2e/global-setup.ts` to prewarm the authenticated dashboard routes for migrations, repositories and inventory. This addresses first-navigation Next.js compilation contention without adding sleeps or bypassing auth.
- Added `tests/e2e/dashboard-navigation.integration.spec.ts` covering all three dashboard routes with response-based API assertions and a cross-workspace invoice authorization assertion.
- Preserved the existing `404 WORKSPACE_ACCESS_DENIED` response contract for inaccessible workspaces; the first test run exposed the contract mismatch and the corrected test now verifies the deliberate non-disclosing response.

Verification for this milestone:

- Focused Playwright: **4 passed** in 1 worker using disposable local SQLite.
- Workspace typecheck: **passed**.
- Targeted ESLint: **passed** with `--max-warnings 0`.
- `git diff --check`: **passed**; only existing line-ending normalization warnings were emitted.
- No application route, authorization rule, migration, provider, database or source branch was changed.

This improves local browser reliability but does not resolve the unavailable Member 2 handoff or prove hosted browser/production behavior. The four previously reported Member 2 failures remain unresolved until reproduced against the synchronized source.

## Recommended first implementation task

The first next action should be **Member 2 handoff synchronization followed by a read-only migration-history evidence package**. Without the missing source checkpoint and authoritative database history, integrating invitations, notifications, or colliding migrations risks silently omitting functionality or corrupting applied history. In parallel, the next independently executable code task is reproducing the four unresolved browser failures with deterministic server readiness and network diagnostics.
