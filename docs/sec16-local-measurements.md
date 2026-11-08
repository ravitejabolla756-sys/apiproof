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
