# MY OWL — P0 Live-Scan Security Report

Date: 2026-10-27  
Decision: **NO-GO for production remediation, redeployment, or a live scan**

## Executive result

The local application hardening is ready for review, but production is not yet cleared for one live scan. The remaining blockers are production-side evidence and configuration, not a failed local authorization test:

1. The production founder user ID has not been independently verified from the production database. The local deterministic fixture ID is `usr_pilot_developer`; it must not be copied into production.
2. The production repository-to-workspace mapping and GitHub App installation association have not been re-verified in this local-only phase.
3. Production GraphQL exposure, RLS policies, table/function/sequence grants, and default privileges remain unresolved. Disabling the REST Data API does not prove those surfaces are closed.

## Local implementation

The following local security changes were made. Unrelated existing worktree changes were preserved.

- `apps/web/src/lib/server/founder-scan-authorization.ts` — fail-closed live-scan authorization using the opaque `APIPROOF_FOUNDER_USER_ID` value; missing or malformed configuration is rejected.
- `apps/web/src/lib/server/scan-service.ts` — applies founder authorization inside the service before database access, protecting alternate callers from route-only bypasses.
- `apps/web/src/app/api/repositories/[id]/scan/route.ts` — returns stable authorization/configuration errors and avoids raw exception logging.
- `apps/web/src/lib/server/github-webhooks.ts` — live webhook-created scan jobs are limited to repositories in a workspace whose owner is the configured founder.
- `apps/web/src/lib/server/scan-worker-scope.ts` — reusable exact-repository and founder-owner SQL scope for PostgreSQL and SQLite.
- `apps/web/src/lib/server/scan-worker.ts` — live worker execution requires explicit repository scope and applies founder-owner filtering before claiming jobs.
- `apps/web/src/app/api/internal/scan-worker/route.ts` — unscoped live worker requests fail with `REPOSITORY_SCOPE_REQUIRED`; unexpected errors are reduced to safe categories.
- `apps/web/src/lib/server/env-config.ts` — production live mode is invalid unless a valid founder ID is configured.
- `tests/p0-live-scan-security.test.ts` — deterministic local coverage for founder authorization, webhook ownership, worker isolation, unscoped worker rejection, and unrelated-job preservation.

Existing repository/workspace authorization remains in place through `requireRepositoryAccess`; the new boundary is additive.

## Founder identity evidence

The local source and seed policy contain the deterministic fixture user `usr_pilot_developer`. That is a local test identity, not proof of the production founder account. No production user identifier was retrieved or exposed. Production must fail closed until the founder/admin confirms the opaque production user ID through an authorized read-only record check and configures it as `APIPROOF_FOUNDER_USER_ID`.

## Scan and worker entry-point coverage

The local source audit found these live scan paths:

- Authenticated manual scan route: `/api/repositories/[id]/scan` → `runRepositoryScan`.
- GitHub webhook push path: `/api/webhooks/github` → `processGitHubWebhook` → pending scan queue.
- Protected worker route: `/api/internal/scan-worker` → `processPendingGitHubScans`.

The service boundary covers direct and alternate callers. The webhook path applies founder-owner filtering in live mode. The worker requires an exact `repositoryId` in live mode and claims only jobs for that repository and a founder-owned workspace. An unscoped worker request cannot drain unrelated tenant jobs.

## GitHub and write boundaries

Local security fixtures use the approved test identifiers for installation `160401452` and repository `1363070568` (`ravitejabolla756-sys/apiproof-github-fixture`). This proves the local authorization logic against known fixture metadata only; it does not independently verify the current production database mapping.

The existing GitHub configuration keeps write mode controlled by `APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true'`. The local changes do not enable it. Draft PR creation and repository writes remain outside this approval.

## Cron and queued-job safety

The deployment catalog now schedules only `/api/internal/provider-changelog` and the bounded `/api/internal/scheduled-rescan` orchestrator. Direct unscoped worker cron execution is intentionally absent because live mode rejects requests without an exact repository scope. The founder-reported Vercel Cron setting remains unverified; inspect the production queue and approve scoped execution before enabling it.

## REST, GraphQL, RLS, and database privileges

Source inspection found the web application using the `pg` package (`^8.23.0`) and direct PostgreSQL adapters. No runtime use of `@supabase/supabase-js`, Supabase REST calls, GraphQL calls, or a GraphQL route was found. The Supabase-related `/rest/v1/` references found in source are provider-intelligence research fixtures, not application database access.

That source result does not establish the production security posture. The following remain **NOT VERIFIED** because this phase authorized local changes/tests only:

- whether `pg_graphql` is enabled in the production Supabase project;
- whether `graphql_public` is externally reachable;
- effective `anon`/`authenticated` table, function, sequence, and default privileges;
- RLS policy coverage and bypass roles;
- current production installation/repository rows and scan queue state.

The local SQLite/application tests do not emulate PostgreSQL role grants, RLS, or Supabase extensions. No production SQL was executed and no customer data was accessed.

## Validation evidence

| Check | Result |
|---|---|
| P0 security tests | **5 passed / 5** in `tests/p0-live-scan-security.test.ts` |
| Related auth, webhook, worker, GitHub safety tests | **8 files, 108 passed** |
| Provider integrity/coverage checks | **4 files, 23 passed** |
| Web package typecheck | **PASS** (`pnpm --filter @apiproof/web typecheck`) |
| Focused ESLint on changed security files and test | **PASS** with `--max-warnings 0` |
| Production build | **PASS** (`pnpm build`) |
| Git diff check | **PASS**; only normal line-ending warnings appeared |
| Root `pnpm typecheck` | **PASS** in the current workspace on 2026-10-30; the package checks and `tsconfig.test.json` completed successfully. This remains dirty-checkout evidence until repeated from a frozen release artifact. |

The production build emitted existing warnings about the missing optional `source-map-support` resolution and Next.js ESLint-plugin detection, but completed successfully.

## GO/NO-GO assessment

**NO-GO for production.** The local code path is hardened and tested, but it would be unsafe to redeploy or start a real scan while the production founder ID, repository/installation mapping, and database exposure controls are unverified.

## Smallest safe production procedure after the blockers are cleared

Do not execute this procedure under the current authorization.

1. Read only the opaque production founder user ID and confirm the repository/workspace/installation mapping for `ravitejabolla756-sys/apiproof-github-fixture`.
2. Complete the production read-only audit for GraphQL, RLS, grants, default privileges, and pending scan jobs.
3. In the isolated existing `apiproof-c2ut` project, set only `APIPROOF_FOUNDER_USER_ID` in Production. Keep `APIPROOF_ENABLE_LIVE_GITHUB=true`, `APIPROOF_ENABLE_LIVE_GITHUB_WRITE=false`, and Vercel Cron disabled.
4. Approve one controlled redeployment and verify `/api/health` reports valid configuration and a connected database.
5. Verify the unscoped worker route is rejected, then separately approve one founder-authenticated scan for the confirmed repository.
6. Confirm only the intended scan/queue/finding records changed and that no repository write occurred.

Rollback is limited to disabling live scanning or removing the founder-only production variable and redeploying the prior known-good deployment. Do not delete scan records or alter customer data as rollback.

## Exact next approval

Approve one **read-only production verification** of the founder user ID, repository/installation mapping, queue state, GraphQL exposure, and effective RLS/grants. After that evidence is clean, request a separate approval for the single Vercel Production configuration update and redeployment. No live scan is approved by this report.
