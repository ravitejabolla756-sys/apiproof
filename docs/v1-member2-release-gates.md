# MY OWL V1 — Member 2 Release Gates

Last updated: 2026-11-08. This is a checklist, not launch approval.

| Gate | Status | Required evidence or unblock |
|---|---|---|
| Isolated worktree | PASS | `/Users/sandstone/Documents/myowl/MY-OWL-V1`, branch `codex/v1-frontend-product`; verify exact HEAD with `git log -1` |
| Original dirty work preserved | PASS | Current worktree preserves the two pre-existing GSAP dependency edits in `apps/web/package.json` and `pnpm-lock.yaml`; no reset, clean, stash, or overwrite was performed |
| Member 1 integration | NOT_INTEGRATED | Deliberately integrate reviewed commits/contracts only after shared changes are complete |
| Typecheck/lint/build | PASS | Current-tree `pnpm lint` and `pnpm typecheck` pass; `pnpm --filter @apiproof/web build` generated 83 static pages. The build emitted only the existing non-blocking Next.js ESLint-plugin configuration warning |
| Full test suite | PASS | Latest current-tree seeded `APIPROOF_LOCAL_SEED_PASSWORD=local-test-seed-password pnpm test -- --no-file-parallelism` passes 1,340 tests across 161 files, with 1 skipped file and 4 skipped tests, in 100.82 seconds; PostgreSQL and hosted CI remain unverified |
| Browser/E2E | PARTIAL | Fresh repository recovery, secondary-route, shared-button, provider-review, shared-dashboard-navigation, findings-filter, organization-role, repository-dialog and detail-fallback journeys pass with keyboard recovery/filtering, 44px touch targets and axe-clean states; findings suite remains 2/2; rebuilt-bundle CI-mode Playwright suite previously passed 92/92 in 2.4 minutes on isolated SQLite. New retained audits pass full axe across 21 public/auth-entry routes in 39.1 seconds and 15 authenticated routes in 1.1 minutes; homepage, informational-route, authenticated-settings, authenticated-workbench, About, FAQ, docs, login, pricing and status mobile interaction journeys also pass. No authorized hosted CI run, integrated staging proof or production proof is recorded |
| Accessibility | PARTIAL | Retained full axe audits now pass all 21 public/auth-entry routes and all 15 authenticated routes, alongside the explicit public not-found response, semantic dialogs, explicit provider-coverage table column scopes and decorative-icon hiding, decorative landing SVGs explicitly hidden while meaningful hero scan labels remain exposed, pointer-only hero background hidden, labeled footer navigation landmark, truthful unconfigured product-video state, skip-link/focus-visible/reduced-motion/touch-target checks pass; desktop/mobile public navigation and collapsed desktop navigation expose active-page state and accessible names, the mobile menu contains keyboard focus while open, both dashboard dialogs contain/restore focus, repository choices are named keyboard-operable radios, account and notification saves expose busy/progress/success/error semantics, the public contact form preserves native required-field focus/validation without rendering a false success state, missing-token password reset keeps unsafe controls disabled, missing verification tokens and expired invitations announce assertive errors with sign-in recovery, dashboard loading/empty/success/error regions expose atomic live-region metadata across audited routes, dashboard collection, repository-detail, provider-rule, compatibility-map and trend/success empty states plus inventory capability badges expose explicit named status/group semantics, protected finding access-denied feedback and dashboard session validation failure expose assertive atomic alerts, auth/reset/verification/invitation flows and repository/Slack integration feedback expose explicit progress/error/success announcements, findings search/filter controls expose explicit names and selection state, workspace switching/workspace-list recovery expose atomic progress/error semantics plus busy metadata, landing pipeline/product-video/FAQ controls expose visible keyboard focus indicators, About/Features/How It Works primary conversion links, all eight homepage navigation/conversion links, the five informational-route `/login` CTAs, authenticated settings form/navigation controls, core workbench action links, repository list/detail recovery controls, inventory/compatibility/provider/activity secondary-route controls, shared Button primitive controls, provider-review candidate actions/source links, shared dashboard navigation/command-palette controls, findings search/filter controls, and owner member-role selectors are measured at 44px or larger on mobile; manual screen-reader/assistive-technology and remaining state review remain open |
| PostgreSQL tenant/RBAC | BLOCKED | Production-representative roles and policies required |
| Transactional email | BLOCKED | Approved domain/provider, credentials and sandbox delivery required |
| Real billing | BLOCKED | Approved provider, signed webhooks and sandbox reconciliation required |
| Legal content | BLOCKED | Privacy, terms and refund pages are explicitly drafts; owner/legal review required |
| Status/incident source | BLOCKED | Truthful no-monitor status page and SEC-18 draft exist; approved status/monitoring source and runbook review required |
| Production release | NO-GO | Do not deploy, activate payments, send real email or push without approval |

Latest local UI-12 evidence: command-palette search textbox and dialog close controls are measured at 44px or larger in the focused mobile dialog journey; focus containment, Escape recovery and axe-clean dialog states pass. Hosted CI, manual screen-reader review, staging and production remain open.

Latest public-form evidence: contact name, email, inquiry-type, message and submit controls are measured at 44px or larger; required-field validation and truthful no-delivery recovery pass. Legal approval, hosted CI, manual review, staging and production remain open.

Latest auth-entry evidence: login OAuth, credential, recovery and signup controls are measured at 44px or larger with axe-clean mobile coverage. Member 1 auth integration, hosted CI, manual review, staging and production remain open.

Latest password-recovery evidence: forgot-password and reset-password inputs, submit actions and return links are measured at 44px or larger with token-safety and axe-clean mobile coverage. Member 1 auth integration, hosted CI, manual review, staging and production remain open.

Latest provider-review evidence: edit-mode Rule title input is measured at 44px or larger with axe-clean filtered-empty and edit states. Provider approval, PostgreSQL/RBAC, hosted CI, manual review, staging and production remain open.

Latest dashboard-navigation evidence: brand and Overview breadcrumb links are measured at 44px or larger, with collapsed-sidebar naming retained. Hosted CI, manual review, PostgreSQL/RBAC, staging and production remain open.

Latest repository-dialog evidence: repository recovery and disconnected-app journeys pass 2/2 locally with axe-clean dialog content, visible-control focus trapping and invoking-control restoration on Escape; selected repository labels remain measured at 44px or larger with named-radio keyboard selection. GitHub configuration, hosted CI, PostgreSQL/RBAC, manual review, staging and production remain open.

Latest workspace-settings evidence: the settings surface exposes `aria-busy` while GitHub and billing requests are pending; the complete dashboard data-state suite passes 16/16 with loading, empty, error, retry and action-feedback coverage. Hosted CI, manual screen-reader review, staging and production remain open.

Latest notification-settings evidence: the preferences surface exposes `aria-busy` during loading and save operations; the loading/error/retry/recovery journey passes 1/1 with axe-clean recovered content. Hosted CI, provider delivery, manual screen-reader review, staging and production remain open.

Latest account-settings evidence: the account surface exposes `aria-busy` during loading and profile/password mutations; the account error/recovery journey passes 1/1 with retry focus recovery. Hosted CI, manual screen-reader review, Member 1 integration, staging and production remain open.

Latest findings-workbench evidence: the findings surface exposes `aria-busy` during initial and refresh requests; the focused loading journey passes 1/1 with existing filter/search accessibility coverage. Hosted CI, manual screen-reader review, PostgreSQL/RBAC, staging and production remain open.

Latest dashboard-overview evidence: the overview exposes `aria-busy` during initial loading and background refresh; the focused loading journey passes 1/1. Hosted CI, manual screen-reader review, PostgreSQL/RBAC, staging and production remain open.

Latest pull-request queue evidence: the queue exposes `aria-busy` during initial and refresh requests; the focused loading journey passes 1/1 while retaining review-only semantics. Hosted CI, manual screen-reader review, PostgreSQL/RBAC, staging and production remain open.

Latest repository-list evidence: the repository surface and loading table status expose `aria-busy` during initial and refresh requests; the deterministic recovery journey passes 1/1 with axe-clean empty/error states. Hosted CI, GitHub configuration, PostgreSQL/RBAC, manual screen-reader review, staging and production remain open.

Latest inventory evidence: the inventory surface and loading status expose `aria-busy` during initial and refresh requests; the focused inventory suite passes 2/2 with mobile filter recovery and axe-clean content. Hosted CI, PostgreSQL/RBAC, manual screen-reader review, staging and production remain open.

Latest compatibility-intelligence evidence: the route and loading status expose `aria-busy` during initial and refresh requests; the focused suite passes 2/2 with reviewed-empty provenance and axe-clean content. Hosted CI, PostgreSQL/RBAC, manual screen-reader review, staging and production remain open.

Latest provider-coverage evidence: the route and loading status expose `aria-busy` during initial and refresh requests; the secondary-route suite passes 2/2 with refresh touch targets and axe-clean empty content. Hosted CI, provider approval, PostgreSQL/RBAC, manual screen-reader review, staging and production remain open.

Latest activity/migration/repository-detail evidence: delayed-response journeys pass 5/5 with `aria-busy` on activity, migration and repository-detail loading states, while existing refresh, retry, focus, empty/error and axe checks remain green. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, provider approval and production remain open.

Latest finding-detail evidence: delayed finding loading and existing migration-plan action feedback pass 2/2 with `aria-busy` on the initial loading status and action controls. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, provider approval and production remain open.

Latest repository-dialog evidence: the complete recovery suite passes 3/3 with busy loading semantics, initial failure/retry, disconnected-app distinction, focus trapping, Escape restoration and axe-clean dialog content. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, GitHub/provider approval and production remain open.

Latest settings evidence: account, notification and workspace initial loading states expose `aria-busy`, with focused settings and organization-audit journeys passing 12/12. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, provider approval and production remain open.

Latest provider-rule evidence: delayed provider-rule loading and existing failure/retry recovery pass 2/2 with busy semantics on the workbench and loading status, plus axe-clean alert/empty coverage. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, provider approval and production remain open.

Latest compatibility-map evidence: delayed shared-component loading and existing initial/refresh retry recovery pass 2/2 with the loading status marked busy. Hosted CI, integrated staging, manual screen-reader review, PostgreSQL/RBAC, provider approval and production remain open.

Latest browser-E2E evidence: the current production build generated 83 pages and the complete 49-spec Playwright matrix passed 130/130 in 4.6 minutes on one worker. Hosted CI, integrated staging, PostgreSQL/RBAC, providers, manual assistive-technology review and production remain open.

Latest verification evidence: the email-verification pending state exposes `aria-busy`, and the authentication loading suite passes 5/5 with existing session/login/reset progress coverage. Hosted CI, integrated staging, Member 1 auth integration, provider delivery, manual screen-reader review and production remain open.

Latest auth-entry evidence: missing verification-token sign-in recovery and expired-invitation accept/recovery actions are measured at 44px or larger with assertive announcements and axe-clean states. Transactional email, Member 1 integration, hosted CI, manual review, staging and production remain open.

Latest refund-page evidence: draft contact and pricing-review links are measured at 44px or larger with versioned draft metadata retained. Legal/provider approval, hosted CI, manual review, staging and production remain open.

Latest footer evidence: all 18 shared footer brand/navigation links are measured at 44px or larger at mobile width with axe-clean footer content. Hosted CI, manual review, staging and production remain open.

Latest navigation evidence: FAQ support, pipeline stage, dashboard brand, and standalone auth home controls are measured at 44px or larger in focused local journeys. The pipeline route retains two unrelated incumbent axe findings; hosted CI, manual review, staging and production remain open.

Latest public accessibility evidence: the pipeline’s inactive-panel focus issue and AST badge contrast issue are remediated; focused pipeline axe, full public axe, and public contrast audits pass locally. Hosted CI, manual review, staging and production remain open.

Latest navbar evidence: the landing brand link, mobile menu toggle, and mobile navigation links are measured at 44px or larger with axe-clean menu content. Hosted CI, manual review, staging and production remain open.

Latest regression evidence: full lint passed and the hermetic repository suite passed 1,341 tests across 162 files with 1 skipped file and 4 skipped tests. Hosted CI, PostgreSQL/RBAC, provider delivery, manual review, staging and production remain open.
