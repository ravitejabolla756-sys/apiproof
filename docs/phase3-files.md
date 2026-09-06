# Phase 3 file changes

Phase 3 touched **57 files: 37 added and 20 changed**. The count includes planning fixtures and saved planning reports, and excludes generated `dist` output and installed dependencies.

## Added

- `packages/shared/src/planning.ts`
- `packages/core/src/planning/context.ts`
- `packages/core/src/planning/deterministic.ts`
- `packages/core/src/planning/evaluation.ts`
- `packages/core/src/planning/index.ts`
- `packages/core/src/planning/llm.ts`
- `packages/core/src/planning/validator.ts`
- `apps/cli/src/plan-format.ts`
- `tests/planning.test.ts`
- `evaluation-plans/README.md`
- `evaluation-plans/labels/cases.json`
- `evaluation-plans/corpus/` (six synthetic repositories, 18 fixture files)
- `evaluation-plans/results-latest.json`
- `evaluation-plans/results-compiled.json`
- `evaluation-plans/example-plan.json`
- `evaluation-plans/example-plan-compiled.json`
- `evaluation/results/phase3-impact.json`
- `docs/phase3-design.md`
- `docs/phase3-results.md`
- `docs/phase3-files.md`

## Changed

- Root and workspace package versions: 0.2.5 → 0.3.0
- `README.md`, `docs/architecture.md`
- `packages/shared/src/models.ts`, `packages/shared/src/change-rules.ts`, `packages/shared/src/index.ts`, `packages/shared/src/version.ts`
- `packages/core/src/index.ts`
- `apps/cli/src/index.ts`
- `tests/cli.test.ts`
- Four registry rules with structured replacement metadata: coupon, deletion helper, shipping parameter and context type
