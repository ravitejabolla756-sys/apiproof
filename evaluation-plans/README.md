# Migration planning evaluation corpus

This separate six-case corpus evaluates Phase 3 planning. It does not reuse the 78-case impact metrics. Cases cover structured parameter and method replacements, multiple affected locations, an affected method without an exact replacement, a runtime-computed member and a dynamic import.

The labels specify expected status, exact deterministic affected locations, required warnings and rationale. The evaluator runs the actual analyzer, builds bounded planning context, invokes the deterministic planner and measures schema validity, exact location retention, status and identity, evidence validity, unsupported fact inventions, warning coverage, failures and insufficient-evidence cases.

The fixtures are synthetic, minimal TypeScript repositories. Unsupported runtime-computed and dynamic-import cases must remain `PLAN_INSUFFICIENT_EVIDENCE`; planning cannot compensate for missing static provenance.

```sh
pnpm apiproof evaluate-plans
pnpm --silent apiproof evaluate-plans --json
```

Current result: 6/6 schema-valid, 6/6 exact locations, 6/6 expected statuses, 6/6 change identities, 0 invalid evidence references, 0 unsupported fact inventions, 100% required-warning coverage, 0 failures and 2 insufficient-evidence cases. These are authored development checks, not human-reviewed production planning accuracy.
