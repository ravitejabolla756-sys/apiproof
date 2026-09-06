# APIProof Phase 3 completion report

Release **0.3.0**, validated 2026-09-06. Phase 3 adds evidence-linked, read-only migration planning. Phase 4 has not started.

## Delivery and validation

Phase 3 touched **57 files: 37 added and 20 changed**. See the [file inventory](phase3-files.md). No dependency was added, no lockfile resolution changed, and generated `dist` output is excluded from the count.

Required checks passed:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`: **148 tests passing in 9 files**
- `pnpm lint`: zero warnings/errors
- `pnpm build`: all five packages build
- `pnpm apiproof evaluate`: exit 0
- `pnpm apiproof evaluate-plans`: exit 0
- source and compiled planning-evaluation JSON are identical
- source and compiled plan outputs match outside their generated timestamp
- readable and JSON `plan` commands pass

## Impact regression check

The Phase 2.5 impact result is unchanged:

| Metric | Result |
| --- | ---: |
| TP | 43 |
| FP | 0 |
| TN | 29 |
| FN | 6 |
| Precision | 100.00% |
| Recall | 87.76% |
| F1 | 93.48% |
| Usage precision / recall / F1 | 100.00% / 88.46% / 93.88% |
| Inconclusive cases | 9 |
| Analysis failures | 0 |

The six Phase 2.5 unsupported patterns remain visible. Planning never attempts to repair missing static provenance.

## Planning evaluation

The separate authored corpus contains **6 cases**: structured coupon replacement, structured method replacement, multiple locations, missing exact replacement, runtime-computed member and dynamic import.

| Objective | Result |
| --- | ---: |
| Schema-valid plans | 6/6 |
| Correct affected-location retention | 6/6 |
| Correct plan status | 6/6 |
| Correct change identity | 6/6 |
| Evidence-reference validity | 6/6; 0 invalid references |
| Unsupported fact inventions | 0 |
| Required-warning coverage | 100% |
| Planning failures | 0 |
| Insufficient-evidence cases | 2 |

These are objective contract checks, not a subjective migration-correctness percentage. The corpus is synthetic and agent-authored; it is not independent human or production validation.

## Architecture

The flow is `reviewed change + ImpactResult → bounded context → MigrationPlanner → validator → MigrationPlan`. Generic analyzer facts and Stripe matching remain deterministic. The planner does not identify symbols, resolve versions or decide affected locations.

The deterministic planner creates `PLAN_READY` only when every affected rule includes structured `replacementPath` or `replacementSymbol` metadata. Otherwise it creates `PLAN_NEEDS_REVIEW` with an inspect step and no fabricated syntax. Inconclusive impacts create `PLAN_INSUFFICIENT_EVIDENCE` and an unresolved question.

The plan schema separates deterministic `facts` from `recommendations`. Every recommendation and step has `supportedBy` evidence IDs. Every plan sets `requiresHumanReview: true`, records warnings that the plan was not executed and that source was not modified, and records planner/version/model/timestamp, evidence IDs, change digest, analyzer digest, model-use flag and validation status.

## Example human-readable plan

```text
APIProof Migration Plan
Status: PLAN_READY
Change: stripe-subscription-coupon-removed
Affected location: src/index.ts:3:1 subscriptions.create
Step: Update subscriptions.create at src/index.ts:3 by replacing coupon with discounts.
Recommendation: Replace coupon with the structured replacement discounts; exact syntax and surrounding business behavior require human review.
Warnings: API version unverified; plan not executed; source not modified; human review required.
```

## Example JSON plan

The complete artifact is [example-plan.json](../evaluation-plans/example-plan.json). Its essential contract is:

```json
{
  "changeId": "stripe-subscription-coupon-removed",
  "status": "PLAN_READY",
  "affectedLocations": [{ "file": "src/index.ts", "line": 3, "column": 1, "symbol": "subscriptions.create" }],
  "facts": [{ "kind": "parameter", "statement": "Affected parameter: coupon." }],
  "recommendations": [{ "text": "Replace coupon with the structured replacement discounts", "supportedBy": ["impact:<stable-id>"] }],
  "requiresHumanReview": true
}
```

## Model boundary and live-model result

`LLMPlanner` is behind `StructuredModelClient`. The supplied request contains only the reviewed change, selected deterministic facts, exact impact findings, bounded redacted snippets and migration instructions. It excludes the full repository, unrelated files, `.env` contents, secret-like literals, lockfile text, credentials and arbitrary filesystem access.

The context limits are 24 nearby lines per affected location, 12,000 characters per snippet and 64,000 total characters. `process.env.NAME`, common credential assignments and Stripe-like `sk_`/`rk_`/`pk_` literals are redacted. This is a practical filter, not perfect secret detection.

No live LLM planner was executed. No external model provider is configured in 0.3.0. `--with-model` fails explicitly with `MODEL_UNAVAILABLE`. Fake-provider tests cover valid structured output, malformed output, provider failure, invented files, invented symbols, invented parameters and invalid evidence. Hidden chain-of-thought is neither requested nor persisted.

## Hallucination and evidence validation

The validator rejects plans whose identity differs from the input change, whose locations are outside deterministic impacts, whose steps use unknown symbols, whose evidence IDs are not in context, whose recommendations lack evidence or whose text names files outside supplied snippets. Model output cannot set line numbers or change identity. Unsupported speculation is not representable in a valid recommendation.

## Insufficient evidence and remaining limitations

Runtime-computed methods and dynamic imports produce `PLAN_INSUFFICIENT_EVIDENCE`. The same behavior applies to the six remaining Phase 2.5 unsupported patterns: deep builders, unresolved aliases, nested response wrappers and transformed Promise chains. A plan never turns an inconclusive impact into a guessed migration.

Records without structured replacement metadata remain `PLAN_NEEDS_REVIEW`. Exact syntax, nested object shape, business behavior, runtime API applicability, tests, reachability and deployment safety remain human questions. No plan claims a verified-safe migration.

## Security boundary

No customer source was modified, executed or transmitted. No LLM call, dependency installation, secret access, branch, commit, pull request, merge or deployment occurred. Existing filesystem containment, source exclusions, bounded reads, redaction, sanitized errors, non-execution tests and read-only architecture remain in force.

## Readiness recommendation

APIProof is ready for a separate Phase 4 design review focused on controlled patch generation in fixtures only. It is not ready for autonomous customer patches, automatic migration claims or production deployment. Before any model-backed use, configure and review a provider implementing the compact structured interface, independently review registry records and labels, and retain human approval as a mandatory gate.
