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
- Architecture: Next.js App Router, Tailwind-style utility classes, direct SQLite/PostgreSQL adapters, workspace membership predicates, Vitest backend/contract coverage, no committed browser E2E or axe runner.
- No production/staging DB, provider, payment, email, deployment, secret or remote Git operation was used.

## 26-task evidence inventory

Statuses are current baseline findings, not completion claims.

| ID | Status | Code/test evidence | Member 1 dependency / next action |
|---|---|---|---|
| AUTH-08 | PASS-LOCAL | `GET/PATCH /api/account`, account page, display-name validation, and `tests/account-settings.test.ts` profile coverage | Production email/account-recovery contract still external |
| AUTH-09 | MISSING | No account deletion route, service or UI found | Await reviewed SEC-19 deletion/retention contract before implementing destructive semantics |
| UI-12 | PASS-LOCAL | Shared focus-visible, skip-link, touch-target and reduced-motion baseline; public/dashboard main targets and browser keyboard/mobile checks | axe/contrast/screen-reader and production visual review remain external |
| UI-13 | PASS-LOCAL | `playwright.config.ts` and `tests/e2e/public-site.spec.ts`; Chromium installed locally; public route/crawl/mobile checks pass | Authenticated flows, axe/Lighthouse and CI browser artifact policy remain open |
| ORG-02 | PASS-LOCAL | Workspace settings API/page with owner gate and slug validation | PostgreSQL runtime/RLS evidence pending |
| ORG-03 | PASS-LOCAL | Hashed 7-day invite tokens, manual-copy invite link, accept page/API, email binding and single-use tests | Approved email delivery intentionally not enabled |
| ORG-04 | PASS-LOCAL | Member list, owner-only role changes/removal, last-owner safeguard, session invalidation and tests | Member 1 revocation contract still needs shared review |
| ORG-11 | PASS-LOCAL | Dedicated `workspace_audit_events`, audit API/page, administrative event writes and tests | Retention/operations policy and production PostgreSQL proof pending |
| BILL-07 | PARTIAL | Paid checkout remains server-blocked; pricing and settings now show beta/coming-soon truth; boundary tests pass | Real provider, signed webhooks and entitlement reconciliation required |
| BILL-08 | PARTIAL | Portal endpoint now returns explicit beta-unavailable response; no simulated customer URL exposed | Real provider portal and owner authorization required |
| BILL-09 | MISSING | No invoice schema, API or UI found | Requires approved provider invoice contract |
| BILL-11 | PARTIAL | `/contact` now marks intake as local/not sent and avoids unsupported SLA/deployment claims | Durable inquiry intake and approved enterprise contract required |
| NOT-01 | PARTIAL | Password-reset email adapter exists; no general provider abstraction/delivery tracking | Coordinate approved provider and delivery state contract |
| NOT-02 | PARTIAL | Password reset backend exists; Member 1 verification changes are only in separate local worktree | Add templates/contract tests without sending real mail |
| NOT-03 | PARTIAL | Slack finding notification queue exists; no email preference/recipient product surface | Reuse trusted events; add preferences and authorization tests |
| NOT-04 | PARTIAL | Scan worker failure states exist; no user notification event path found | Define durable actionable-failure event contract |
| NOT-05 | PARTIAL | PR/migration lifecycle APIs exist; no notification delivery integration found | Integrate only after Member 1 PR-08 event contract is reviewed |
| NOT-06 | PASS-LOCAL | `user_notification_preferences`, `GET/PATCH /api/account/notifications`, settings UI, required-category guard and 3 tests | Email/Slack delivery availability remains provider-gated |
| NOT-10 | MISSING | No digest schema, scheduler or template found | Define cadence/clock/dedupe contract and worker integration |
| WEB-08 | PASS-LOCAL | Evidence-backed `/faq` page, footer link, native details controls and browser reachability check | Content owner review remains open |
| WEB-11 | PARTIAL | `/privacy` and `/terms` identify draft/legal-review status and remove unsupported guarantees | Owner/legal approval required |
| WEB-12 | PARTIAL | `/refunds` draft clearly says no paid beta entitlement/provider is active | Owner/legal/provider contract required |
| WEB-13 | PARTIAL | `/status` is truthful and footer no longer claims uptime; updates remain informational | Approved live status/monitoring source required |
| WEB-14 | PARTIAL | `sitemap.ts`, `robots.ts`, canonical site fallback and public main targets added | Metadata/performance/Lighthouse measurement required |
| WEB-15 | PASS-LOCAL | Public route, crawl, keyboard and mobile Playwright checks pass; contact form explicitly does not claim delivery | Full link audit, axe, performance and live-contact proof remain open |
| SEC-18 | PASS-LOCAL | `docs/v1-member2-incident-response.md` includes severity, roles, containment, evidence, recovery and tabletop | Owner/security review and real alert/on-call/status channels required |

## Current checkpoint

- Phase: local implementation slices for account, organization, public surfaces, billing boundaries, notifications and incident response complete; final verification/reconciliation remains.
- Highest-priority next task: final full test/build/browser verification, then review remaining provider/legal/PostgreSQL gates.
- Shared contracts: Member 1's local contracts cover finding lifecycle, merged-SHA scans, resolution evidence and deterministic planning; local email/billing/RBAC/deletion gaps remain unintegrated.
- External blockers: approved transactional email, real billing provider, PostgreSQL role/RLS evidence, deletion/revocation contracts, legal approval, status/monitoring source and deployment access.
- Verification: targeted Member 2 contracts 29/29 pass; Playwright public-site 3/3 pass; TypeScript, targeted ESLint and production build pass. Repository-wide Vitest is not clean because 47 pre-existing fixture/evaluation cases fail with digest/line-number drift outside changed source.
- Next safe action: fixture-owner remediation and Member 1 contract review; keep production recommendation NO-GO until the failing suite and external gates are cleared.
