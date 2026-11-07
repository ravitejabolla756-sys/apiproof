# MY OWL V1 — Member 2 QA Report

Updated implementation report; browser checks are local evidence only and are not production approval.

## Tooling baseline

- Repository scripts provide Vitest, TypeScript, ESLint and Next production build.
- Playwright and `@axe-core/playwright` are declared as root dev dependencies. A hermetic browser suite exists under `tests/e2e/`, Chromium was installed locally, and representative public/authenticated axe scans are automated. No Lighthouse measurement is included.
- No live email, payment, GitHub App or production data was used.

## Initial checks

- Public routes exist for home, features, how-it-works, security, docs, pricing, contact, privacy, terms, cookies, updates and 404.
- Account, workspace, invitation, audit and notification settings now have server routes and responsive pages; organization mutations are owner-gated.
- Shared focus-visible, skip-link, touch-target, reduced-motion and single-main-landmark rules are implemented. Dialogs now expose semantic names and live regions; dashboard heading hierarchy, repository table headers and the public home landmark are accessible. Browser coverage exercises skip-link focus, mobile menu disclosure, public route reachability, metadata, root internal links, truthful contact-form behavior, crawl endpoints, local seeded sign-in, core dashboard/settings routes, keyboard dialog focus, and axe scans. Full-route manual screen-reader and Lighthouse measurements remain open.
- The footer now says “Beta · Read-only safety boundary” and links to a truthful status page; no live monitor is claimed.

## Verified commands

- `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- Targeted ESLint for account, organization, notification, public-site and billing files — PASS.
- `pnpm exec vitest run tests/account-settings.test.ts --no-file-parallelism` — 5/5 PASS.
- `pnpm exec vitest run tests/auth-session.test.ts --no-file-parallelism` with `APIPROOF_LOCAL_SEED_PASSWORD=local-test-seed-password` — 13/13 PASS.
- `pnpm exec vitest run tests/organization-management.test.ts --no-file-parallelism` — 5/5 PASS.
- `pnpm exec vitest run tests/notification-preferences.test.ts --no-file-parallelism` — 3/3 PASS.
- `pnpm exec vitest run tests/member2-billing-boundaries.test.ts --no-file-parallelism` — 2/2 PASS.
- `pnpm exec playwright test tests/e2e/public-site.spec.ts` — 14/14 PASS locally with one worker against the hermetic SQLite fixture, including public route/crawl/mobile, metadata and internal-link probes, non-sending contact form, authenticated settings, repository/detail denial, seeded dashboard routes, loading/empty/error/permission-denied states, invitation failure, core authenticated axe scans, and keyboard/dialog focus checks. Single-worker execution is intentional because the local SQLite adapter is not a concurrent browser-test database.
- `pnpm exec vitest run tests/analyzer.test.ts tests/patching.test.ts --no-file-parallelism` — 116/116 PASS, including CRLF/LF-independent source audit and patch fixture digest regression coverage.
- `pnpm exec vitest run tests/evaluation.test.ts tests/patch-cli.test.ts tests/patching.test.ts tests/web-backend.test.ts --no-file-parallelism` with the local seed password — 126/127 PASS; patching, evaluation and patch CLI now pass, while the external `C:\apiproof-github-fixture` assertion still expects line 5 and observes line 4.
- `pnpm exec vitest run tests/verification-workspace.test.ts tests/web-backend.test.ts --no-file-parallelism` with the local seed password — 22/23 PASS; the verification workspace suite is green after aligning its test digest oracle with the canonical text-digest contract, with the same external fixture line mismatch remaining.
- `pnpm exec vitest run tests/organization-management.test.ts --no-file-parallelism` — 6/6 PASS, including stable audit cursor pagination and cross-workspace denial.
- `pnpm exec playwright test tests/e2e/public-site.spec.ts --grep "signs in with the local seed"` — 1/1 PASS; authenticated account, workspace and notification settings journey remains green after the audit API pagination response was added.
- `pnpm build` — PASS; all workspace packages built and Next generated 80 static pages.

## Full-suite baseline exception

The latest complete run, before the final test-only digest-oracle alignment, completed with 154 test files passing, 2 failing and 1 skipped (1,313 passed, 2 failed, 4 skipped). The canonical text-digest changes removed the prior 43 patching digest failures and the evaluation/patch-CLI drift; the follow-up targeted run shows those suites green. The remaining application-level failure is the external `C:\apiproof-github-fixture` line-number assertion (`expected 5`, observed 4), which was not edited from this isolated worktree. These results prevent a clean release gate and require fixture-owner remediation; failures were not suppressed or weakened.

## Required next checks

- Run the new CI browser job and inspect its retained artifacts, then complete the remaining manual browser checks before claiming UI-13 complete.
- Complete manual screen-reader/full-route checks for keyboard-only navigation, mobile widths, dialogs, forms, loading/error/empty/denied states and reduced motion.
- Run link/metadata checks for every public route and record actual outcomes.
- Capture measured performance only from a reproducible local or approved environment; do not invent Lighthouse/Core Web Vitals values.
