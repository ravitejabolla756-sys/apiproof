# Production verification worker

Draft PR verification is split across two runtimes. The Vercel application validates the signed-in user's workspace, repository, migration and completed-scan baseline, then queues a durable job in the shared production database. It does not execute Docker and does not write a GitHub PR while verification is pending.

## Worker host requirements

Run `pnpm verification:worker` as a long-lived Node.js 22.14+ process on a trusted Linux host with a reachable Docker Engine. Apply database migrations with `pnpm db:migrate` before starting workers. The host must have the exact verification image (`node:22.14.0-alpine3.21`) preloaded; the verifier uses `--pull=never` and will report unavailable until its pinned image and Linux engine pass the readiness probe.

Configure the worker with the same production `DATABASE_URL`, GitHub App credentials/configuration, and evidence-signing secret (`APIPROOF_SECRET` or `AUTH_SECRET`) used by the app, plus `APIPROOF_ENABLE_LIVE_GITHUB=true`, `APIPROOF_ENABLE_LIVE_GITHUB_WRITE=true`, and a unique `APIPROOF_VERIFICATION_WORKER_ID`. Set `DOCKER_PATH` only if the Docker CLI is not available as `docker` on `PATH`. Keep credentials in the host's secret manager, never in repository files or job payloads. The worker only advertises readiness after checking Docker Linux mode, the pinned image, required GitHub write configuration, and the evidence-signing secret.

During verification, the existing sandbox still provisions artifacts in its bounded preparation phase and runs the locked verification sequence in Docker with network disabled, a read-only captured-source mount, and the existing patch/evidence gates. A worker outage is surfaced as `VERIFICATION_EXECUTION_UNAVAILABLE`; no PR is created. Jobs are workspace/repository/baseline-bound, leased, recoverable after worker loss, and status is visible only after migration authorization succeeds.

## Operational boundary

Local non-production proposal requests retain the existing synchronous local Docker path. A successful local verification is not evidence that production has a worker. Production is considered executable only after the worker is deployed, its readiness heartbeat is fresh, and an authenticated production request can complete the real worker flow. This code change alone does not deploy or configure that infrastructure.
