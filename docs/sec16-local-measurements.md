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
