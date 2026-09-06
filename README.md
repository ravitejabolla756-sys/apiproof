# APIProof

Deterministic Stripe impact analysis, evidence-linked migration planning, controlled candidate patches, isolated fixture verification, behavioral contracts, and review-gated GitHub proposals. **Phase 7 (0.7.0)** adds a fake-provider-tested source-control boundary with permanent merge, default-branch, and deployment prohibitions. No customer repository or target application is executed. See the [Phase 7 design](docs/phase7-design.md) and [completion report](docs/phase7-results.md).

**APIProof must never automatically merge pull requests or deploy customer code. Human review remains mandatory in all future phases.**

## Run

Requires Node.js **22.14+** and pnpm **10** (pinned development version: 10.30.3).

```sh
pnpm install --frozen-lockfile
pnpm apiproof scan test-fixtures/affected
pnpm apiproof impact test-fixtures/affected --change fixtures/stripe-change.json
pnpm --silent apiproof impact test-fixtures/multiple --change fixtures/stripe-change.json --json
pnpm apiproof impact evaluation/corpus/discounts-update --change-id stripe-subscription-coupon-removed
pnpm apiproof evaluate
pnpm --silent apiproof evaluate --json
pnpm apiproof plan evaluation-plans/corpus/coupon-direct --change-id stripe-subscription-coupon-removed
pnpm --silent apiproof plan evaluation-plans/corpus/coupon-direct --change-id stripe-subscription-coupon-removed --json
pnpm apiproof evaluate-plans
```

Replace the fixture path with a local repository containing a root `package.json`. Quote paths containing spaces. Customer dependencies need not be installed. Use pnpm's `--silent` flag when piping JSON; it suppresses pnpm's own script banner. `plan` accepts a reviewed registry record by ID and is always read-only.

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
node apps/cli/dist/index.js scan test-fixtures/affected --json
```

The development command works before building. The compiled CLI runs after `pnpm build`, with no tsx loader. `pnpm test:watch` enables interactive test development. Install scripts are disabled for this workspace. The scanner never installs dependencies or executes scripts in the repository it analyzes.

No API keys, environment variables, database, network service, or runtime configuration are required. No server is deployed in this phase.

## Architecture

| Location | Responsibility |
| --- | --- |
| `apps/cli` | Argument validation, safe terminal formatting, JSON output, exit codes |
| `packages/core` | Small `ApiProvider` and `RepositoryAnalyzer` contracts; scan/impact orchestration |
| `packages/shared` | Zod input/result schemas and safe error type |
| `packages/analyzers/src/typescript` | Bounded file snapshot, package metadata, AST binding resolution, locations and contexts |
| `packages/providers/src/stripe` | Stripe descriptor, change validation, deterministic symbol/version matching |
| `fixtures` | Explicitly synthetic method and type changes |
| `test-fixtures` | Affected, unaffected, no-Stripe, and multiple-usage repositories |
| `tests` | AST, metadata, matching, safety and CLI regressions |
| `registry/stripe` | Nine curated official change records with explicit review lifecycle |
| `packages/core/src/evaluation` | Ground-truth validation, case/usage comparison and metrics |
| `evaluation` | Authored integration corpus, independent labels and saved result artifacts |

Dependency direction: CLI → core + adapters; adapters → core contracts + shared schemas; core → shared. The language adapter receives a provider descriptor rather than importing the Stripe implementation. A future provider implements `ApiProvider`; a future language implements `RepositoryAnalyzer`.

The design uses static AST bindings rather than names or text matching. It is intentionally a small local pipeline. File and memory-input budgets limit each analysis; independent snapshots can later be processed by isolated workers without changing the core contracts. See [architecture and decisions](docs/architecture.md) for assumptions and extension boundaries.

## What a report means

- `providerUsed` means a dependency or an AST import/usage was detected; a declared dependency alone does not prove a runtime call.
- Dependencies report declared ranges, exact **installed** versions, and **locked** versions separately. `versionResolution` uses installed metadata, then locks, then an unambiguous exact declaration. A declaration or lockfile never proves installation. Ranges remain unknown; drift and lockfile conflicts produce diagnostics.
- Usages contain repository-relative paths, one-based line/column positions, exclusive end positions, symbols, nearest function/class context, and the originating import/require/type evidence. Source snippets and argument values are omitted.
- Impacts link back to usage IDs, rule indices, stable reason codes and structured AST/version/official-source evidence. SDK constraints use semver. Unknown exact versions retain matches with lower confidence. Known versions outside the source-upgrade range are explained in diagnostics.
- `potentially-affected` means at least one matching usage exists. `no-matched-usage` means no match within supported patterns. `inconclusive` means there was no match but detected coverage gaps prevent a clean result. None means “safe to migrate.”
- Confidence is the heuristic **strength of static evidence that a usage is affected**, not a calibrated probability, migration-success prediction, production-safety score or business-risk measure. Direct bindings start at 0.95; builder/Promise propagation caps at 0.90, annotations at 0.85, exact declarations at 0.75, and unknown SDK/runtime API versions at 0.70. The overall value is the minimum applicable cap.
- `coverage.complete` only describes the stated `supported-static-patterns` scope; `coverage.limitations` is always present.
- `audit.inputDigest` hashes the bounded source/metadata snapshot and limits. `changeDigest` hashes the validated change. IDs and output are stable for unchanged inputs. These are reproducibility identifiers, not signed attestations or runtime proof.
- `verification.status` remains `not-run`. Scan/impact schema 1.2 adds expression semantics and propagation locations while preserving numeric confidence. `analysisMode` explicitly distinguishes synthetic fixtures from reviewed registry analysis. Corpus/evaluation schema 1.1 requires per-case provenance and adds category/pattern breakdowns; see the [schema transition](docs/phase2.5-design.md).

Exit codes: **0** completed analysis, including potential impacts or incomplete coverage; **1** analysis failure; **2** invalid arguments, inputs, or unsupported provider. Automation should inspect `status`, `coverage`, and `diagnostics`, not only the exit code. `--json` emits one JSON object on stdout, including failures; human-readable errors go to stderr.

Evaluation uses the same read-only pipeline. Impact evaluation reports failed cases separately and exits 1 if any analysis failed. Planning evaluation is separate and measures schema validity, exact location retention, status/identity correctness, evidence validity, unsupported fact inventions and required-warning coverage; it does not reuse impact accuracy as a planning-quality score. See the [impact corpus](evaluation/README.md), [planning corpus](evaluation-plans/README.md), [registry lifecycle](registry/README.md), and [Phase 3 results](docs/phase3-results.md).

Example excerpt from the affected fixture:

```text
Package (package.json): declared ^16.0.0; installed unknown; locked 16.12.0
  src/customer.ts:6:10  method customers.retrieve (loadCustomer)
Change: synthetic-customer-retrieve-v1 (synthetic)
Result: potentially-affected; 1 potentially affected usage(s).
```

## Change fixtures

Both supplied changes are **fictional test specifications**, not factual Stripe migration advice. No changelog is scraped and no documentation is fetched. Test fixture repositories are analysis inputs, excluded from the pnpm workspace; their minimal lockfiles describe metadata scenarios and are not installation fixtures.

Changes are validated with `ApiChangeSchema`: provider, ID, title, description, package, exact/prefix symbols and method/type kind, old/new behavior, migration instructions, severity, provenance, and optional evidence URL, SDK semver range, target SDK version, API version, and effective date. Unknown fields are rejected. Prefix matching requires a dot-separated boundary. Changes labeled `official` require a source URL; the URL is recorded, not verified or fetched. API version strings are separate from SDK versions.

Official records additionally require `RegistryChangeSchema` metadata and must be `reviewed` or `verified` before analysis. Drafts are rejected. Shipped records have attributed **agent source reviews**, not independent human verification. Runtime analysis never fetches evidence URLs. Synthetic fixtures cannot be used by the evaluator.

## Supported patterns and limitations

Supported: default/named/namespace Stripe imports, unshadowed literal `require('stripe')`, import-equals, `new Stripe(...)`, CommonJS factory calls, local client aliases, object resource destructuring, relative-file exports/imports, typed clients and class properties, nested resources, optional chains, literal/const-string element access, and imported Stripe types. Bound method references remain conservative candidates. Capability checks remain visible in scans but do not match behavior rules unless the rule explicitly includes them.

Argument extraction supports typed class clients, object keys, const aliases and known spreads, literal fingerprints, and at most three local builder calls through straight-line object returns. Response extraction follows awaited results and first fulfillment parameters of direct calls or const Promise aliases, including destructuring. Function/call-site locations make propagation reviewable. Argument values and source snippets are not emitted. Provider rules interpret these generic facts.

Only `.ts`, `.tsx`, `.mts`, and `.cts` are parsed. Hidden folders/files, `node_modules`, `dist`, `build`, `coverage`, and `vendor` are excluded. All other TypeScript files, including tests and declarations, are analyzed; tsconfig include/exclude and gitignore are not applied. JSON manifests in discovered subdirectories provide package scopes. npm lockfiles v1–v3 and pnpm v6/v9 importer metadata are supported.

Not supported: tsconfig path aliases, package exports maps, project references, arbitrary factory/argument dataflow, dynamic imports, runtime-computed members, conditional/deep builders, transformed Promise chains, all mutation/alias propagation, JavaScript-only repositories, semantic typechecking of customer code, or runtime Stripe API-version discovery. Detected unresolved imports, computed accesses, response escapes/callbacks, mutations, syntax problems and skipped files generate coverage diagnostics; not every unsupported construct can be detected.

Budgets: 5,000 TypeScript files, 50,000 directory entries, depth 64, 1 MiB per source file, 4 MiB per metadata file, and 32 MiB total bytes read; change files are limited to 256 KiB. Symlinks in the source tree are skipped. Installed-package metadata links may be read only when their resolved path stays inside the repository.

This local reader assumes a stable checkout owned by the operator. Path containment checks and bounded reads are not an OS sandbox against concurrent malicious filesystem mutation or compiler resource exhaustion. Remote untrusted repositories require process isolation and stronger resource controls before onboarding. No LLM receives repository content.

## Phase 3 boundary

Phase 3 creates read-only plans from reviewed change records and deterministic impact evidence. The deterministic planner is the default. The LLM planner is an injected interface with structured-output validation and no configured external provider; `--with-model` fails explicitly rather than silently sending repository content. Phase 2.5 retains six harder false negatives, and planning returns `PLAN_INSUFFICIENT_EVIDENCE` for those unsupported impacts. Phase 4 adds a separate fixture-only patch boundary below. Phase 5 adds FakeSandbox verification and an opt-in DockerSandbox for explicitly registered fixtures. Customer patching and GitHub writes remain unavailable.

## Phase 4 fixture patches

```sh
pnpm apiproof patch evaluation-patches/corpus/coupon-basic --change-id stripe-subscription-coupon-removed
pnpm apiproof evaluate-patches --json
node apps/cli/dist/index.js patch evaluation-patches/corpus/coupon-basic --change-id stripe-subscription-coupon-removed --json
```

Only manifest-listed, digest-matched bundled fixtures are accepted. Each run creates and retains `.tmp/patch-runs/<UUID>/repository`; original fixtures and dependency files are immutable. Strict schemas, exact evidence-linked AST edits, provenance/digest checks, path and semantic guards, bounded sizes and TypeScript parsing precede the candidate report. Human review is mandatory. The generator supports direct discount properties and selected method/type renames; unsupported transformations refuse generation. No target scripts, tests, installs, builds, Git operations or deployments run. No external patch model is configured. See the [patch corpus](evaluation-patches/README.md) and [executable registry](registry/patches/README.md).
