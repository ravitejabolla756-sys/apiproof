# MY OWL V1 — Member 2 QA Report

Updated implementation report; browser checks are local evidence only and are not production approval.

## Tooling baseline

- Repository scripts provide Vitest, TypeScript, ESLint and Next production build.
- Playwright is now declared as a root dev dependency and a hermetic public-site suite exists under `tests/e2e/`. Chromium was installed locally for verification. No axe runner or Lighthouse measurement is included.
- No live email, payment, GitHub App or production data was used.

## Initial checks

- Public routes exist for home, features, how-it-works, security, docs, pricing, contact, privacy, terms, cookies, updates and 404.
- Account, workspace, invitation, audit and notification settings now have server routes and responsive pages; organization mutations are owner-gated.
- Shared focus-visible, skip-link, touch-target and reduced-motion rules are implemented. Browser coverage exercises skip-link focus, mobile menu disclosure, public route reachability and crawl endpoints. Contrast, screen-reader, and Lighthouse measurements remain manual/blocked.
- The footer now says “Beta · Read-only safety boundary” and links to a truthful status page; no live monitor is claimed.

## Verified commands

- `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — PASS.
- Targeted ESLint for account, organization, notification, public-site and billing files — PASS.
- `pnpm exec vitest run tests/account-settings.test.ts --no-file-parallelism` — 5/5 PASS.
- `pnpm exec vitest run tests/auth-session.test.ts --no-file-parallelism` with `APIPROOF_LOCAL_SEED_PASSWORD=local-test-seed-password` — 13/13 PASS.
- `pnpm exec vitest run tests/organization-management.test.ts --no-file-parallelism` — 5/5 PASS.
- `pnpm exec vitest run tests/notification-preferences.test.ts --no-file-parallelism` — 3/3 PASS.
- `pnpm exec vitest run tests/member2-billing-boundaries.test.ts --no-file-parallelism` — 2/2 PASS.
- `pnpm exec playwright test` — 3/3 PASS after the final assertion correction.
- `pnpm build` — PASS; all workspace packages built and Next generated 80 static pages.

## Full-suite baseline exception

`APIPROOF_LOCAL_SEED_PASSWORD=local-test-seed-password pnpm test -- --no-file-parallelism` completed with 151 test files passing, 1 skipped, and 5 files failing (1,267 passed, 47 failed, 4 skipped). The failures are outside Member 2 changed source: 43 patching cases fail with the pre-existing `FIXTURE_DIGEST_MISMATCH`, evaluation and patch CLI cases fail on existing fixture/input drift, and the web-backend case reports an existing fixture line-number mismatch. The pricing-copy contract was updated for the canonical ₹5,000/₹15,000 plan values and passes in the targeted 29-test set. These failures prevent a clean release gate and require fixture-owner remediation; they were not suppressed or weakened.

## Required next checks

- Add a repeatable browser runner or document the justified alternative before claiming UI-13 complete.
- Exercise keyboard-only navigation, mobile widths, dialogs, forms, loading/error/empty/denied states and reduced motion.
- Run link/metadata checks for every public route and record actual outcomes.
- Capture measured performance only from a reproducible local or approved environment; do not invent Lighthouse/Core Web Vitals values.
