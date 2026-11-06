# MY OWL V1 — Member 2 Progress

Last updated: 2026-11-07
Workstream: `codex/v1-frontend-product`
Worktree: `C:\YC-my-owl-v1-member2`
Baseline: `d1cd9f4d90f574b8ab647c9852ec38261e83b6f8` (`origin/main`)

## Phase 0 preflight

- Authoritative dirty worktree: `C:\YC-my-owl-v1`, branch `codex/my-owl-v1-development`, 238 pre-existing status entries. It was not edited, stashed, cleaned or assimilated.
- Isolated Member 2 worktree: `C:\YC-my-owl-v1-member2`, branch `codex/v1-frontend-product`, clean at the reviewed baseline before this document.
- Member 1 worktree is accessible locally at `C:\YC-my-owl-v1-member1`, branch `codex/v1-backend-security`, with local commits `f4476bc` and `882b020`; those commits are not integrated into this branch and were not assumed to exist remotely.
- Remote: `https://github.com/ravitejabolla756-sys/apiproof.git`; baseline `HEAD...origin/main` was `0 0`.
- Architecture: Next.js App Router, Tailwind-style utility classes, direct SQLite/PostgreSQL adapters, workspace membership predicates, Vitest backend/contract coverage, and a committed single-worker Playwright/axe local browser harness.
- No production/staging DB, provider, payment, email, deployment, secret or remote Git operation was used.

## 26-task evidence inventory

Statuses are current baseline findings, not completion claims.

| ID | Status | Code evidence | Test evidence | Member 1 dependency | External blocker | Next action |
|---|---|---|---|---|---|---|
| AUTH-08 | DONE_VERIFIED_LOCAL | `GET/PATCH /api/account`, password-change route/page and session invalidation | `account-settings` 5/5; `auth-session` 13/13 | AUTH-05 enforcement remains separate | Recovery/email policy | Review linked-account password semantics |
| AUTH-09 | BLOCKED | No deletion route/service/UI | No destructive-flow test; intentionally not invented | SEC-19 is PARTIAL with no deletion contract | Legal retention and durable deletion policy | Obtain owner/Member 1 contract |
| UI-12 | PARTIAL | Focus-visible, skip-link, touch-target, reduced-motion and single-main baseline | Keyboard/mobile checks and axe scans pass on pricing/FAQ/status/notifications | None | Manual screen-reader/full-route review | Expand manual and route coverage |
| UI-13 | PARTIAL | Playwright/Chromium harness uses a deterministic seeded SQLite fixture and serial worker configuration | `pnpm exec playwright test` 8/8 local: public, auth, repository/detail, finding, migration, PR, organization/invite, billing, notification, loading/empty/error/denied/mobile states | None | CI artifact policy, timeout-specific UI behavior and full external integration remain incomplete | Add CI artifact retention and remaining timeout/manual checks |
| ORG-02 | PARTIAL | Workspace settings API/page, owner gate and slug validation | `organization-management` 5/5 | ORG-05 role matrix remains PARTIAL | PostgreSQL tenant/RLS proof | Reconcile role matrix and run approved checks |
| ORG-03 | PARTIAL | Hashed 7-day single-use invites, email binding, accept page/API | Organization suite covers expiry/replay/email/member guards | ORG-05/ORG-10 coordination | Approved transactional email unavailable | Add provider-backed acceptance after approval |
| ORG-04 | PARTIAL | Owner-only role/removal UI/API, last-owner guard and session invalidation | Organization suite covers owner/member boundaries | ORG-10 is MISSING; revocation contract absent | PostgreSQL/concurrent proof | Integrate reviewed backend contract |
| ORG-11 | PARTIAL | `workspace_audit_events`, audit API/page and attributed writes | Organization suite covers audit records | Retention/operations policy unresolved | PostgreSQL retention/RLS proof | Review retention and migrate safely |
| BILL-07 | PARTIAL | Paid checkout server-blocked; pricing/settings show beta states | Billing boundaries 2/2; pricing included in 29/29 | Provider lifecycle remains PARTIAL | Provider sandbox/signatures/reconciliation | Owner selects and approves provider |
| BILL-08 | PARTIAL | Portal endpoint returns beta-unavailable; no simulated URL | Billing boundary test covers refusal | Provider contract required | Real provider portal/authorization | Implement projection after approval |
| BILL-09 | MISSING | No invoice schema/API/UI | No invoice test | Provider lifecycle contract | Invoice source/retention policy | Define provider-backed contract |
| BILL-11 | PARTIAL | Contact/enterprise copy is explicit local intake with no SLA claim | Public browser checks truthful copy | None | Durable approved intake workflow | Owner chooses intake channel |
| NOT-01 | PARTIAL | Reset adapter exists; no general trusted event/delivery abstraction | Reset tests only; no provider proof | Event categories are backend guidance | Approved email provider/delivery state | Define event/recipient contract |
| NOT-02 | PARTIAL | Reset route/template path exists; delivery not active | Auth/session tests; no SMTP sandbox | AUTH-05 template approval pending | Approved provider/domain | Review variables and delivery contract |
| NOT-03 | PARTIAL | Slack finding queue and preference UI/API | Notification preferences 3/3; no email delivery proof | Trusted event guidance and Slack auth | Provider connection/durable delivery | Integrate recipient auth/dedupe |
| NOT-04 | PARTIAL | Worker failure states; no general actionable-failure event path | No end-to-end user delivery test | SEC-13 worker monitoring partial | Durable event/retry/alert contract | Define failure event/retry policy |
| NOT-05 | PARTIAL | PR/migration APIs; no user notification integration | No lifecycle notification test | PR-08 event contract requires review | Trusted event/recipient delivery | Integrate after review |
| NOT-06 | DONE_VERIFIED_LOCAL | Preference schema/service/API/UI with required guards | `notification-preferences` 3/3 | Delivery availability is provider-owned | Email/Slack providers inactive | Connect to authoritative providers |
| NOT-10 | BLOCKED | No digest schema, scheduler or template | No digest test | SEC-13 is PARTIAL | Scheduler/worker/event/retention contracts absent | Define contract with owner and Member 1 |
| WEB-08 | DONE_VERIFIED_LOCAL | Evidence-backed FAQ, footer link and native details | FAQ/route assertions in 5-test browser suite | None | Content-owner review | Approve final copy |
| WEB-11 | PARTIAL | Privacy/terms marked draft; unsupported guarantees removed | Public route reachability | None | Owner/legal approval | Obtain sign-off |
| WEB-12 | PARTIAL | Refund page marked draft; no paid entitlement claimed | Public route reachability | Billing contract remains partial | Owner/legal/provider approval | Finalize after billing decision |
| WEB-13 | PARTIAL | Status says no live monitor; footer avoids uptime claim | Status/truthful-copy assertions | Monitoring SEC-11/13 incomplete | Approved status source | Connect after monitoring approval |
| WEB-14 | PARTIAL | `sitemap.ts`, `robots.ts`, metadata and main targets | Crawl endpoint checks pass | None | Lighthouse/Core Web Vitals absent | Run reproducible performance audit |
| WEB-15 | PARTIAL | Public navigation, contact copy, invitation error, mobile menu and crawl surfaces | Browser suite 8/8 including axe; full links/forms/perf incomplete | None | Live contact/production proof absent | Complete public matrix and performance |
| SEC-18 | PARTIAL | Draft runbook covers severity, roles, containment, evidence, recovery and tabletop | Document review only; no owner tabletop | Monitoring/alert contracts partial | Approved channels and reviewed exercise | Owner + Member 1 review and record |

## Current checkpoint

- Phase: local implementation slices for account, organization, public surfaces, billing boundaries, notifications and incident response complete; verification is complete and release reconciliation remains.
- Highest-priority next task: review remaining provider/legal/PostgreSQL/deletion/scheduler gates with the owner and Member 1.
- Shared contracts: Member 1's local contracts cover finding lifecycle, merged-SHA scans, resolution evidence and deterministic planning; local email/billing/RBAC/deletion gaps remain unintegrated.
- External blockers: approved transactional email, real billing provider, PostgreSQL role/RLS evidence, deletion/revocation contracts, legal approval, status/monitoring source and deployment access.
- Verification: targeted Member 2 contracts 29/29 pass; Playwright browser/axe suite 8/8 pass serially against a local SQLite fixture; TypeScript, targeted ESLint and production build pass. Repository-wide Vitest is not clean because 46 existing fixture/evaluation cases fail with digest/line-number drift outside changed source (152 files pass, 4 fail, 1 skipped).
- Next safe action: fixture-owner remediation and Member 1 contract review; keep production recommendation NO-GO until the failing suite and external gates are cleared.
