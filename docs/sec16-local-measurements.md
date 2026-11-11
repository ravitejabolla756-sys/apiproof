# SEC-16 Local Measurement Record

Captured 2026-11-07 with:

```powershell
pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Host: Node `v24.14.1`, Windows `10.0.26300`, Intel Core Ultra 5 125H, 18 logical CPUs. Each scenario ran 24 bounded in-process operations with concurrency capped at 4. The database fixture was an isolated local SQLite file. No external HTTP requests, production/staging traffic, credentials, or live services were used.

| Scenario | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: |
| API health handler | 1.02 | 34.70 | 35.72 | 561.98 | 4 |
| GitHub webhook signature/claim/record | 31.46 | 166.09 | 172.19 | 65.23 | 4 |
| SQLite `SELECT 1` | 0.13 | 0.25 | 0.55 | 14,363.52 | 4 |
| Scan-worker queue metrics | 1.19 | 3.53 | 4.61 | 2,150.48 | 4 |

The run passed all 4 SEC-16 tests. Separate deterministic scenarios verified transient recovery within three attempts, exhaustion at the configured retry limit, and injected operation failures with sanitized error reporting. These values are a single local regression baseline, not an SLO or a capacity claim; host load and SQLite scheduling affect timing. Staging load, provider/database infrastructure behavior, operational thresholds, and worker-death recovery remain separately gated.

## 2026-11-08 bounded retry timeout regression

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --reporter=dot`. The suite passed 10/10 after adding a deterministic never-settling retry callback. The test uses a 5 ms timeout and verifies cooperative abort and that the retry loop stops after the first uncertain attempt. This is control-flow verification, not a throughput or capacity measurement.

The same test run emitted the following local in-process measurements (24 operations per scenario, concurrency 4):

| Scenario | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: |
| API health handler | 0.27 | 3.56 | 3.78 | 4,403.18 | 4 |
| GitHub webhook signature/claim/record | 12.47 | 20.91 | 22.24 | 236.77 | 4 |
| SQLite `SELECT 1` | 0.02 | 0.04 | 0.13 | 70,609.00 | 4 |
| Scan-worker queue metrics | 0.17 | 0.34 | 1.84 | 6,510.95 | 4 |

These are environment-specific single-run observations and do not establish SLOs, staging capacity, or real provider/database behavior.

## 2026-11-08 SEC-16 throughput accounting correction

- When a timeout stopped the harness from starting remaining iterations, `throughputPerSecond` still divided requested iterations by elapsed duration. The metric now uses actual started operations, and the timeout regression verifies the numerator reflects `started` rather than `iterations`.
- A repeat of `pnpm exec vitest run tests/sec16-load-resilience.test.ts --reporter=dot` passes 9/9. The emitted run measured 24 operations per scenario at concurrency 4: API health p50/p95 0.59/4.83 ms; GitHub webhook p50/p95 5.08/6.69 ms; SQLite SELECT p50/p95 0.052/0.085 ms; queue metrics p50/p95 0.32/0.74 ms. These are local single-run observations; they vary by host load and are not SLOs. ESLint and full workspace typecheck pass. Staging infrastructure and failure-recovery rehearsal remain unverified.

## 2026-11-08 full-suite SEC-16 baseline

Captured during the seeded serial full repository run on code HEAD `93b79f88c424c12d423b1bfdbd4291749053a5f4`. Each scenario used 24 in-process operations at concurrency 4 with a disposable local SQLite fixture.

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| API health handler | 4.519 | 0.319 | 2.433 | 2.638 | 5,311.38 | 4 |
| GitHub webhook signature/claim/record | 23.463 | 3.010 | 4.000 | 4.364 | 1,022.88 | 4 |
| SQLite `SELECT 1` | 0.324 | 0.021 | 0.037 | 0.129 | 74,142.72 | 4 |
| Scan-worker queue metrics | 1.901 | 0.173 | 0.296 | 0.512 | 12,624.93 | 4 |

These are one-run local observations, not SLOs, staging capacity claims, or evidence about real provider/PostgreSQL behavior.

## 2026-11-08 error-redaction hardening regression

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=dot`. The suite passed 11/11 after replacing regex-only error-code acceptance with an explicit allowlist. The failure-injection case confirms both token-style and AWS secret-key-style exception messages are excluded from report output. The run also emitted 24-operation local measurements at concurrency 4: API health p50/p95 0.284/2.343 ms; GitHub webhook signature/claim/record 2.886/4.023 ms; SQLite SELECT 0.022/0.051 ms; worker queue metrics 0.148/0.267 ms. Single-run local observations only, not SLO or staging-capacity evidence.

## 2026-11-08 focused SEC-13/SEC-16 rerun

At checkout HEAD `14a1dfeb32e42dc1b5ae1e15e8d94d84bbca2161` (no source changes since code HEAD `7d07f00814475cf4605dca7f4d9f63e066ef851a`), the serial focused command covering worker observability and the SEC-16 local harness passed 2 files / 18 tests. SEC-16's fresh local measurements: API health p50/p95/p99 0.283/2.436/2.664 ms (5,476 ops/s); GitHub webhook signature/claim/record 2.907/4.074/4.334 ms (1,065 ops/s); SQLite SELECT 0.025/0.120/0.133 ms (57,513 ops/s); worker queue metrics 0.176/0.345/0.490 ms (11,856 ops/s). All four scenarios used 24 local in-process operations at concurrency 4. These are single-run local observations, not capacity or SLO claims. Approved alerting and staged failure recovery remain open.

## 2026-11-08 database-environment boundary regression

Command: `pnpm test -- --no-file-parallelism --maxWorkers=1 tests/sec16-load-resilience.test.ts --reporter=dot`. The suite passed 11/11 after extending the local-only guard to reject `DATABASE_URL`, `APIPROOF_DATABASE_URL`, and `APIPROOF_STAGING_DATABASE_URL`; the test verifies the callback is never invoked for each remote-database setting. ESLint and workspace typecheck pass. Fresh 24-operation, concurrency-4 local observations:

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| API health handler | 8.870 | 0.576 | 5.043 | 5.454 | 2,705.81 | 4 |
| GitHub webhook signature/claim/record | 37.118 | 4.615 | 6.339 | 7.047 | 646.58 | 4 |
| SQLite `SELECT 1` | 0.348 | 0.024 | 0.048 | 0.132 | 68,886.34 | 4 |
| Scan-worker queue metrics | 1.845 | 0.171 | 0.273 | 0.485 | 13,010.95 | 4 |

Single-run host-specific observations only; they are not SLOs, capacity claims or evidence about remote databases/providers. No network traffic was generated.

## 2026-11-08 bounded harness rerun

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`. The suite passed 11/11 and emitted a fresh 24-operation, concurrency-4 local measurement set:

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| API health handler | 4.741 | 0.343 | 2.564 | 2.784 | 5,062.44 | 4 |
| GitHub webhook signature/claim/record | 22.902 | 2.829 | 4.085 | 4.385 | 1,047.94 | 4 |
| SQLite `SELECT 1` | 0.311 | 0.020 | 0.044 | 0.113 | 77,120.82 | 4 |
| Scan-worker queue metrics | 1.711 | 0.152 | 0.259 | 0.465 | 14,027.70 | 4 |

The process used a newly generated, process-only local seed and had `DATABASE_URL`, `APIPROOF_DATABASE_URL`, and `APIPROOF_STAGING_DATABASE_URL` removed. No network traffic was generated. This is one host-specific local observation, not an SLO, capacity claim, or remote database/provider evidence.

## 2026-11-08 aggregate scenario-budget regression

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=dot`. The suite passes 12/12. New guards estimate the worst-case serialized batch budget from iteration/retry count, configured concurrency, and per-operation timeout, rejecting workloads whose operation-time budget exceeds 60 seconds before callbacks run. This is an input-budget bound, not a hard wall-clock preemption guarantee for callbacks that ignore abort or block the event loop. Targeted ESLint and workspace typecheck pass.

The same run measured 24 operations at concurrency 4 per local scenario:

| Scenario | p50 ms | p95 ms | p99 ms | Throughput ops/s |
| --- | ---: | ---: | ---: | ---: |
| API health | 1.026 | 6.782 | 7.533 | 1,790 |
| GitHub webhook | 5.183 | 7.751 | 8.511 | 588 |
| SQLite query | 0.041 | 0.189 | 0.202 | 29,633 |
| Worker queue metrics | 0.209 | 0.336 | 0.633 | 10,509 |

Host load and local SQLite affect these timings. These are reproducible local harness observations, not capacity, SLO, staging, or provider evidence.

## 2026-11-08 current-code seeded full-suite harness sample

During the seeded serial full-suite run at code HEAD `1a0409438c1eff4c5578144d948b3d6837d9ce1f`, the SEC-16 test emitted the following four-scenario sample (24 in-process operations per scenario, concurrency 4):

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| API health handler | 16.045 | 0.986 | 9.492 | 10.074 | 1,495.80 | 4 |
| GitHub webhook signature/claim/record | 152.680 | 16.764 | 32.259 | 35.173 | 157.19 | 4 |
| SQLite `SELECT 1` | 0.368 | 0.025 | 0.051 | 0.142 | 65,270.60 | 4 |
| Scan-worker queue metrics | 1.790 | 0.167 | 0.278 | 0.445 | 13,409.32 | 4 |

The run used a process-only throwaway test seed and removed all application/staging database URL variables. These are single-run, host-specific local observations; no external network service was called, and these values are not capacity, SLO, staging, PostgreSQL, or provider evidence. Differences from earlier samples underline host/runtime variance.

## 2026-11-08 follow-up local run

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose` on Member 1 code HEAD `b1a503da24f5ad34d8d80f5795c719de1c09c67b`. All 12 tests passed. The process used a disposable `APIPROOF_LOCAL_SEED_PASSWORD`; application and staging database URL variables were unset. The four scenarios each ran 24 operations at maximum concurrency 4:

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| API health | 6.838 | 0.445 | 3.753 | 4.091 | 3,509.85 |
| GitHub webhook ping | 32.662 | 4.228 | 5.720 | 6.369 | 734.80 |
| SQLite query | 0.522 | 0.037 | 0.074 | 0.185 | 45,977.01 |
| Worker queue metrics | 2.600 | 0.240 | 0.406 | 0.647 | 9,231.83 |

These are single-run, host-specific local measurements. No external network traffic was generated. Variance from prior samples means they are harness output only, not an SLO, capacity estimate, or staging/PostgreSQL/provider evidence.

## 2026-11-12 integration-worktree verification

Command: `pnpm exec vitest run tests/sec16-load-resilience.test.ts --no-file-parallelism --maxWorkers=1 --reporter=dot`. The integrated suite passed 12/12. Each scenario ran 24 in-process operations at concurrency 4 against disposable local SQLite and application handlers:

| Scenario | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Max in flight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| API health handler | 12.502 | 0.868 | 6.758 | 7.323 | 1,919.66 | 4 |
| GitHub webhook signature/claim/record | 63.722 | 8.127 | 13.059 | 14.818 | 376.64 | 4 |
| SQLite `SELECT 1` | 1.475 | 0.115 | 0.327 | 0.402 | 16,275.60 | 4 |
| Scan-worker queue metrics | 4.798 | 0.552 | 0.866 | 1.381 | 5,001.56 | 4 |

The run rejected production and configured remote-database environments, used no HTTP client or socket, and generated no external network traffic. These are host-specific local observations only; they are not SLOs, hosted capacity evidence, autoscaling evidence, PostgreSQL evidence, or failure-recovery certification.
