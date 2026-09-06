# Phase 3 evidence-linked migration planning

Release 0.3.0 adds planning after deterministic impact analysis. It proposes review steps without modifying or executing customer code.

## Flow and ownership

```text
reviewed registry record + ImpactResult
                 ↓
       bounded context builder
                 ↓
       MigrationPlanner abstraction
          ├── DeterministicPlanner
          └── LLMPlanner (injected client only)
                 ↓
          deterministic validator
                 ↓
       MigrationPlan (human review required)
```

The analyzer remains responsible for package/version resolution, AST bindings, locations and static evidence. Stripe provider rules remain responsible for interpreting change records. Core planning consumes the resulting impact and reviewed registry data; no planner performs repository analysis or invents affected symbols.

## Plan contract

`MigrationPlanSchema` separates `facts` from `recommendations`. Facts carry statements, deterministic evidence IDs and optional exact locations/symbols. Recommendations and steps carry `supportedBy` IDs and `unsupportedSpeculation: false`. `affectedLocations` are copied from impact evidence and validated against the input. Every plan records change identity, status, assumptions, warnings, unresolved questions, evidence, confidence, planner audit metadata and `requiresHumanReview: true`.

Statuses are explicit: `PLAN_READY` means every affected usage has structured replacement metadata; `PLAN_NEEDS_REVIEW` means deterministic impact exists but replacement syntax or business context is incomplete; `PLAN_INSUFFICIENT_EVIDENCE` means no affected usage was proven or impact is inconclusive; `PLAN_UNSUPPORTED_PATTERN` and `PLAN_GENERATION_FAILED` reserve explicit future failure paths. Inconclusive Phase 2.5 impacts are never handed to an LLM as if missing provenance could be solved by prose.

## Bounded context

`buildPlanningContext` includes only the validated reviewed change and migration instructions, exact impact identity/symbol/location/reason/version facts, package resolution facts without lockfile text, official source summaries already present in the change, and at most 24 nearby source lines per location, 12,000 characters per snippet and 64,000 total characters. Paths remain within the analyzed repository.

Context preparation replaces `process.env.NAME`, common credential assignments and Stripe-like secret literals with `[REDACTED_ENV]` and `[REDACTED_SECRET]`. It never reads `.env` files or sends unrelated files. These are practical safeguards, not perfect secret detection. Missing context becomes a warning and unresolved question rather than fabricated source.

## Deterministic planner

Registry rules may carry structured `replacementPath` or `replacementSymbol` metadata. The planner uses those fields only when the affected operation has a matching rule. It can state that `coupon` should be reviewed against `discounts`, or `subscriptions.del` against `subscriptions.cancel`, while preserving exact location and evidence links. It does not invent object nesting, values, business semantics or exact replacement syntax. Records without structured replacements produce an inspect/review step and `PLAN_NEEDS_REVIEW`.

Planning confidence is separate from analyzer confidence. `analysisConfidence` summarizes deterministic evidence; `planningConfidence` reflects structured replacement support and is capped at 0.90 for the baseline; `evidenceCoverage` measures supplied snippets against affected locations. None is probability of deployment safety or migration success.

## Optional model planner

`LLMPlanner` depends on `StructuredModelClient`, which accepts only the bounded change, facts, impacts, snippets and migration instructions. The model returns `ModelOutputSchema`: summary, steps, recommendations, assumptions, risks and unresolved questions. It cannot set file paths, line numbers or change identity; the application derives those from deterministic evidence.

Validation rejects malformed output, symbols not in the impact, parameters not in deterministic facts, evidence IDs outside context and source paths not present in supplied snippets. Recommendations without evidence are rejected. Only validated structured fields and concise audit metadata are retained; hidden reasoning is never requested or persisted.

There is no live OpenAI-compatible client in 0.3.0 and no external model evaluation was performed. The CLI `--with-model` option fails explicitly with `MODEL_UNAVAILABLE` until a separately configured provider is supplied. Unit tests use a deterministic fake provider to exercise acceptance, malformed output, invented files/symbols/parameters, evidence rejection and provider failure.

## Evaluation and security

`evaluation-plans` is independent from impact evaluation. It measures schema-valid rate, exact affected-location retention, expected statuses, change identity, evidence validity, unsupported fact inventions, warning coverage, failures and insufficient-evidence cases. It does not claim a subjective migration correctness percentage. Every plan records planner implementation, tool version, model identifier or null, timestamp, evidence IDs, change digest, analyzer input digest, model reasoning usage and validation status.

Phase 3 creates no patches. No source mutation, customer-code execution, branch/commit/PR operation, deployment, dependency installation, secret access or network model call occurs.
