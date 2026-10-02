# MY OWL Free-Beta Readiness Checklist

Internal operator and beta-user reference. This describes the current web product and its limits; it is not a promise that every repository can be migrated or that every deployment has production integrations configured.

## Product and user journey

- [ ] **What MY OWL does:** connects a user's workspace to a GitHub App installation, reads selected repositories, analyzes supported source with deterministic AST rules for currently supported Stripe and Twilio API changes, records findings, creates migration plans, attempts patch/verification gates, and can open a review-only GitHub Draft PR when all required checks and live-write gates pass.
- [ ] **What MY OWL does not do:** guarantee detection of every API break; infer runtime behavior; provide general-purpose code migration; run the customer's entire CI pipeline; merge PRs; write to the default branch; or deploy customer code. Findings and plans are evidence for review, not a guarantee of safety.
- [ ] **Sign up/login:** the web app creates a user, default workspace, and server-side session. Session cookies are HTTP-only, SameSite=Lax, Secure in production, and expire after 30 days. Expired/revoked sessions require signing in again.
- [ ] **Connect GitHub:** the authenticated user starts GitHub App installation from the dashboard. The callback validates signed, expiring, user/workspace-bound state and records the installation against that workspace. The new-tab flow returns to MY OWL; the dashboard refreshes connection state from the authenticated GitHub-repositories endpoint and also listens for cross-tab updates.
- [ ] **Select a repository:** the picker lists repositories accessible to the active workspace's installation. Connecting a repository stores its workspace association. The app must have access to the chosen repository.
- [ ] **Scan:** a manual scan fetches the current default-branch HEAD; a GitHub push webhook queues a scan for the pushed commit for the worker. The worker uses the queued SHA. The scanner fetches bounded source snapshots and runs AST analysis in memory; it does not install or execute repository code during scanning.
- [ ] **Finding:** a finding is a deterministic registry-rule/AST-pattern match with a repository path, line, symbol, reason, and source evidence. It means “this supported pattern matched,” not “the application is definitely broken” or “the migration is safe.” Coverage gaps and unsupported constructs can cause misses.
- [ ] **Migration plan:** generating a plan records deterministic, evidence-linked intent for a finding. It does not yet apply a patch or verify the repository. The baseline is the scan's commit SHA.
- [ ] **Verification:** when proposing a Draft PR, MY OWL fetches the approved source at that baseline, checks its recorded digest, applies the deterministic patch, and runs the configured install/build/typecheck/test gates in a sandbox. Any failed or missing gate blocks proposal creation. A local/test fake sandbox is not production verification evidence.
- [ ] **Important verification limit:** the current proposal verifier reconstructs a bounded workspace from `package.json` and selected source files; it does not fetch every repository file, lockfile, test, and build configuration. Therefore its gates are not equivalent to the customer's full CI. Treat this as a beta limitation; do not represent a passed result as full-project CI coverage.
- [ ] **Draft PR boundary:** production writes require the live GitHub configuration and explicit live-write gates. The transport writes the complete resulting file content to an isolated `apiproof/*` branch based on the exact scan SHA and creates a Draft PR only. There is no auto-merge. Proposal creation fails closed when verification or write configuration is missing. Current write validation accepts only `main` as the PR base; repositories with another default-branch name cannot currently complete this proposal flow.

## Repository and scan requirements

- [ ] Install the MY OWL GitHub App on the account/organization and grant it access to the selected repository. Repository contents read permission is needed for scans; contents write and pull-request write permissions are needed for Draft PR proposals.
- [ ] Use an active, connected repository with a committed default branch, a valid root `package.json`, and files the scanner can fetch. An empty repository or one with no selected source/package files cannot be scanned and returns an empty-repository error (HTTP 422 on the manual scan route); a missing/invalid root manifest can fail analysis.
- [ ] The live scan snapshot is bounded to at most 2,000 selected files, with a 2 MiB per-file limit. Source extensions fetched include TypeScript and JavaScript variants, but AST analysis currently supports `.ts`, `.tsx`, `.mts`, and `.cts` only. Hidden/excluded directories are not scanned.
- [ ] Stripe/Twilio detection is based on package metadata when available. If no provider dependency is detected, the current scanner defaults to Stripe analysis; an empty result is not proof that the repository has no breaking change.
- [ ] Live scanning uses GitHub's real source and SHA. Fixture/synthetic fallback is restricted to local development/test paths; production must fail closed rather than use fixture source.
- [ ] Manual scans run synchronously through the repository scan endpoint. Push-triggered scans are queued and require the protected scan worker to run. A webhook receipt is not proof that its scan has completed.

## Failure and troubleshooting guide

- [ ] **GitHub still says “Connect GitHub”:** allow pop-ups for MY OWL, finish the GitHub App installation in the opened tab, then return/focus the original dashboard. The dashboard re-reads connection state. If it remains disconnected, use Refresh/reopen the picker and report the time and sanitized error; do not share cookies or OAuth URLs containing state.
- [ ] **Connected, but repository list is empty:** check the GitHub App installation's repository access settings. An active installation can legitimately expose zero repositories.
- [ ] **Repository cannot be scanned:** confirm it is active, the installation still has access, the default branch exists and has commits, and the repository contains supported files within size/count limits. For an empty repository, add an initial commit/source file and scan again.
- [ ] **Scan fails:** capture the displayed error/code, repository full name and ID, scan/request ID if shown, timestamp with timezone, and whether the scan was manual or push-triggered. Do not report a finding count from a failed scan.
- [ ] **Finding page says not found/access denied:** confirm the signed-in account and active workspace are the ones that own the repository. A stale/expired session may need a fresh login.
- [ ] **Plan fails:** capture the finding ID, visible error/code, time, and repository/scan SHA. A plan is not created until the authenticated plan request succeeds.
- [ ] **Verification/proposal fails:** no successful Draft PR should be reported unless GitHub confirms it. Capture the migration ID, baseline SHA, verification status/gates, sanitized failure reason, and any GitHub response category. Do not blindly retry if the prior attempt may have created a branch, commit, or PR.
- [ ] **Draft PR unavailable on non-`main` default branch:** this is a current product limitation, not a repository setup mistake. Report the repository's actual default branch; do not rename it solely to work around MY OWL.

## Account recovery and production dependencies

- [ ] Password recovery is implemented at `/forgot-password` and `/reset-password`. Reset links use a single-use token that expires after 20 minutes; successful reset revokes the account's existing sessions.
- [ ] Password-reset email delivery depends on SMTP configuration: `SMTP_HOST`, `SMTP_PORT` (defaults to 587), `SMTP_USER`, `SMTP_PASSWORD`, `PASSWORD_RESET_FROM`, and a canonical HTTPS application URL in production (`NEXT_PUBLIC_APP_URL` or `APIPROOF_APP_URL`). `SMTP_SECURE` may be set to `true`; port 465 is treated as secure. Do not include any of these secret values in support reports.
- [ ] If required email configuration is absent or invalid, the reset-request endpoint returns `503 PASSWORD_RESET_UNAVAILABLE`; users will not receive a reset email. Beta operations must confirm SMTP delivery readiness before promising account recovery.

## Known readiness limits and validation record

- [ ] Do not promise comprehensive API-change coverage, full repository CI verification, support for non-`main` proposal bases, or automatic repair of partially completed remote GitHub writes.
- [ ] Fake transports and fake verification can be used by tests/non-production paths; they are not live evidence. Passing mocked tests does not prove a live GitHub scan, execution, or Draft PR.
- [ ] Last local validation recorded on 2026-10-02: **559 tests passed across 43 files**; workspace typecheck and lint passed; production build completed. Build emitted warnings that `source-map-support` could not be resolved through the `ts-morph` dependency and that the Next.js ESLint plugin was not detected. These warnings did not fail that build.
- [ ] No live production validation is implied by the local test/build results. Live GitHub App, database, SMTP, and sandbox readiness must be verified in the target deployment without exposing credentials.

## What beta users should report

Please include the affected step, expected versus actual result, timestamp and timezone, browser/OS, sanitized visible error and code, repository full name/ID, default branch, scan/finding/migration IDs, and baseline SHA when available. Include whether the action was manual or triggered by a GitHub push. Redact source snippets if sensitive. Never send passwords, reset links/tokens, cookies, GitHub tokens, private keys, SMTP credentials, database URLs, or other secrets.
