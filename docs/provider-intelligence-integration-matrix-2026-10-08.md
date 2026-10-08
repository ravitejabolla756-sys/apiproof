# Provider Intelligence Staging Integration Matrix

This matrix was completed before reconciliation. The staging branch is the safety and runtime boundary; the expansion branch is the reviewed intelligence source.

| Subsystem | Staging implementation | Expansion implementation | Classification | Canonical result |
|---|---|---|---|---|
| Feature flag | server-only `providerIntelligenceV1Enabled` | compatible strict flag semantics | BOTH_EQUIVALENT | staging flag boundary |
| Scan worker orchestration | GitHub fetch, snapshot, bounded transaction, rollback | local Productization entrypoint | BOTH_DIVERGED | staging orchestration calling one Productization entrypoint |
| Repository snapshot | worker-owned snapshot | analyzer snapshot support | BOTH_EQUIVALENT | worker snapshot passed to analyzer |
| Productization entrypoint | worker calls `runProductizationScan` | 15-provider-aware scan | BOTH_DIVERGED | one reconciled `runProductizationScan` |
| TypeScript analyzer | staging integration path | expanded evidence extraction | BOTH_DIVERGED | expanded evidence with staging boundary |
| Python analyzer | staging Python dispatch | expanded HTTP/version/auth coverage | BOTH_DIVERGED | expanded generic analyzer |
| Normalized usage IR | staging-compatible usage shape | model/resource/endpoint/domain/auth/API-version fields | BOTH_DIVERGED | one language-neutral superset |
| Compatibility evaluator | shared evaluator call | 20 reviewed rules and expanded dimensions | BOTH_DIVERGED | one registry-backed evaluator |
| Reviewed registry | 10 rules | 20 rules / 15 providers | BOTH_DIVERGED | expansion registry |
| Candidate registry | existing candidate separation | 31 expansion candidates and review records | EXPANSION_ONLY | expansion candidate separation |
| Reviewed-copy workflow | existing local review flow | batch 7 review/provenance | BOTH_DIVERGED | expansion workflow, no new promotion |
| Persistence projection | bounded/redacted Productization projection | scan result fields | BOTH_DIVERGED | staging bounds over expanded result |
| Persistence bounds | staging size/failure checks | no competing boundary | STAGING_ONLY | staging boundary authoritative |
| Raw-source privacy | staging redaction/no raw source | analyzer evidence only | BOTH_EQUIVALENT | no raw source persistence |
| Secret redaction | worker/API privacy tests | expanded auth/header evidence | BOTH_DIVERGED | redact values, retain safe metadata |
| Tenant isolation | repository access and transaction scope | provider tests only | STAGING_ONLY | staging access boundary |
| Inventory API | existing scan/API inventory | expanded metadata support | BOTH_DIVERGED | persisted Productization projection |
| Compatibility Map API | persisted evidence path | expanded records | BOTH_DIVERGED | same persisted model |
| Compatibility Proof API | repository-bound proof retrieval | 20-rule metadata | BOTH_DIVERGED | same persisted model and registry metadata |
| Dashboard | generic compatibility rendering | API-version/domain/auth metadata | BOTH_DIVERGED | generic fields, no provider branches |
| Failure matrix | worker exceptions, malformed/oversized projection | evaluator fail-closed rules | BOTH_DIVERGED | union of both gates |
| Incremental hooks | existing staging hooks | no competing implementation | STAGING_ONLY | preserve staging hooks |
| Productization tests | staging worker tests | 20-rule and benchmark tests | BOTH_DIVERGED | retain both with updated counts |
| Worker E2E tests | staging fake-worker tests | no worker path | STAGING_ONLY | staging E2E boundary |
| Privacy tests | staging privacy tests | analyzer privacy tests | BOTH_EQUIVALENT | retain both |
| API contract tests | staging route contracts | expanded registry contracts | BOTH_DIVERGED | same projection contract |

## Canonical flow

GitHub fetch → repository snapshot → `runProductizationScan()` → normalized IR → `PRODUCTION_COMPATIBILITY_REGISTRY` → deterministic evaluator → bounded/redacted projection → persistence → Inventory/Map/Proof → dashboard.

There is one intended implementation of each orchestration/evaluation responsibility. The expansion branch supplies reviewed intelligence and analyzer capabilities; the staging branch supplies runtime safety, persistence, tenant, and rollback boundaries.
