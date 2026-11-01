# Production verification worker

Draft PR verification is split across two runtimes. The Vercel application validates the signed-in user's workspace, repository, migration and completed-scan baseline, then queues a durable job in the shared production database. It does not execute Docker and does not write a GitHub PR while verification is pending.

## Worker host requirements

Use the repository root as the working directory. The root `verification:worker` script runs `tsx apps/web/scripts/verification-worker.ts`; `tsx` is a root `devDependency`, so a production-only dependency install cannot run this command. Keep the root and workspace development dependencies installed.

For a reproducible deployment from an immutable checkout, use this preparation sequence:

```sh
git checkout <exact-release-commit>
pnpm install --frozen-lockfile
pnpm --filter "@apiproof/web^..." build
pnpm verification:worker
```

The filtered build builds the workspace dependencies of `@apiproof/web`: `@apiproof/shared`, `@apiproof/core`, `@apiproof/providers`, and `@apiproof/analyzers`. Their package exports select `dist` by default. The filter excludes `@apiproof/web` itself, so it does not run the Next.js application build. The worker imports the web server modules directly through `tsx`; it does not require a separately built web app. Root `pnpm build` is broader than necessary because it also builds the Next.js app. The dependency packages can be built in workspace dependency order by pnpm.

Run this as a long-lived Node.js 22.14+ process on a trusted Linux host with a reachable Docker Engine. Apply database migrations with `pnpm db:migrate` before starting workers; the worker does not run migrations itself. The host must have the exact verification image (`node:22.14.0-alpine3.21`) preloaded; the verifier uses `--pull=never` and will report unavailable until its pinned image and Linux engine pass the readiness probe.

### Environment placement

The Vercel app and worker must use the same production database (`DATABASE_URL`) and the same evidence-signing secret (`APIPROOF_SECRET`, or `AUTH_SECRET` where the verifier's fallback is used). Both need the GitHub App ID/private key for their GitHub operations. Vercel's live repository/scan paths require `APIPROOF_ENABLE_LIVE_GITHUB=true`; the worker readiness probe requires both `APIPROOF_ENABLE_LIVE_GITHUB=true` and `APIPROOF_ENABLE_LIVE_GITHUB_WRITE=true`. The production proposal route only queues jobs; the worker performs verification and GitHub writes.

The worker currently requires these global GitHub configuration fields: `GITHUB_INSTALLATION_ID`, `GITHUB_ALLOWED_REPOSITORY_ID`, `GITHUB_ALLOWED_REPOSITORY_OWNER`, and `GITHUB_ALLOWED_REPOSITORY_NAME`. This is an existing readiness/config-validation coupling, not the source of the job's tenant identity. `assertLiveWriteConfig()` calls `assertLiveConfig()`, which rejects missing global installation/repository fields. Actual job execution resolves the installation from the job repository's workspace and then constructs the provider/write target using the database-backed installation and repository identity. Do not remove these globals as an operational workaround until the validation path has been deliberately changed and tested.

The same trusted worker also drains approved provider-rule rescan jobs and scheduled repository rescan jobs continuously, in bounded batches. The scheduled-rescan endpoint still enqueues nightly work and remains a recovery/fallback path; it is not the only dispatcher. Rescan failures are isolated from verification-runtime readiness, and durable leases keep failed work retryable.

Worker-host-only settings are `APIPROOF_VERIFICATION_WORKER_ID` (unique, required) and optionally `DOCKER_PATH` (only when the CLI is not named `docker` or not on `PATH`). Set `NODE_ENV=production` on the worker. Keep credentials in the host's secret manager, never in repository files or job payloads. The worker only advertises readiness after checking production mode, Docker Linux mode, the pinned image, required GitHub write configuration, and the evidence-signing secret. `GITHUB_WEBHOOK_SECRET`, `CRON_SECRET`, and app URL settings are not read by the worker readiness/runtime path; they remain application configuration for their respective web endpoints/features.

During verification, the existing sandbox still provisions artifacts in its bounded preparation phase and runs the locked verification sequence in Docker with network disabled, a read-only captured-source mount, and the existing patch/evidence gates. A worker outage is surfaced as `VERIFICATION_EXECUTION_UNAVAILABLE`; no PR is created. Jobs are workspace/repository/baseline-bound, leased, recoverable after worker loss, and status is visible only after migration authorization succeeds.

## Operational boundary

Local non-production proposal requests retain the existing synchronous local Docker path. A successful local verification is not evidence that production has a worker. Production is considered executable only after the worker is deployed, its readiness heartbeat is fresh, and an authenticated production request can complete the real worker flow. This code change alone does not deploy or configure that infrastructure.
