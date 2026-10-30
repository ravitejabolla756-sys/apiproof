# Architecture and decisions

> **Current release boundary (2026-10-30):** The repository is in a
> provider-intelligence beta build phase. The current local capability surface
> includes the 19-provider discovery/catalog, 50 reviewed compatibility rules,
> provider-change monitoring, human review, guarded rescans, and Draft-PR
> evidence. Live deployment proof is still outstanding. The product remains
> read-oriented for customer repositories: direct automatic writes to `main`,
> automatic merge, and automatic deployment are not enabled.

The historical Phase 3 planning notes below describe the earlier APIProof
milestone and are retained for architectural provenance. They are not the
current beta capability contract.

## Current release: Phase 3

The current implementation is 0.3.0. See [Phase 2.5 deterministic hardening](phase2.5-design.md), [Phase 3 design](phase3-design.md) and [Phase 3 validation](phase3-results.md). The Phase 3 path is `impact evidence -> bounded planning context -> deterministic or injected model planner -> validator -> human-review plan`. It never writes customer source.

## Phase 2 extension

The package boundaries below remain intact. Phase 2 separates generic argument/response extraction (`arguments.ts`, `responses.ts`) from Stripe rule interpretation (`rule-evidence.ts`), version assessment (`version.ts`), evidence-reviewed registry loading (`registry.ts`), and evaluation (`core/src/evaluation`). No database or service framework was introduced, and no dependency additions were needed.

Core schemas now represent category-specific rules, review lifecycle and attribution, structured impact evidence/reason codes, version provenance, and labeled evaluation inputs/results. Official records pass the review gate on every public provider analysis path. Legacy synthetic records remain isolated by `analysisMode` and are excluded from evaluation. Output schema 1.1 is an additive extension; the CLI/tool release is 0.2.0.

Parameter extraction follows bounded const object aliases/spreads and stores property names/locations plus hashes of direct literals. Provider predicates compare hashes against documented enum values. It does not serialize customer values. Response extraction follows explicit awaited method calls, const aliases/destructuring, and imported type annotations; it does not infer arbitrary factory returns or callback arguments. Constructor assignments to typed client fields are distinguished from later mutations.

Evaluation injects the existing impact runner through a small interface. It reads source-grounded labels, checks paths and positions, runs the actual analyzer/provider pipeline, then calculates confusion counts and exact-position usage matches. The harness never derives labels from predictions. Failed cases are explicit errors with a failed CLI exit; inconclusive cases remain scored. Digests associate metrics with their labels, change definitions and input snapshots. See [evaluation methodology](../evaluation/README.md) and [results](phase2-results.md).

Scaling remains local and bounded: the new fact resolvers have cycle/depth guards, the registry caps at 100 files, labels at 1,000 cases, and each source scan retains Phase 1 budgets. No cross-tenant cache or unbounded whole-program analysis is introduced. Repeated cases currently rescan repositories to preserve simple snapshot ownership; per-revision caching can follow measured need.

## Product boundary

## Phase 3 planning boundary

`packages/core/src/planning` owns planning contracts and orchestration. `context.ts` selects only reviewed change data, exact impact findings, package/version facts, short redacted snippets and bounded migration instructions. `deterministic.ts` creates evidence-linked review steps when registry rules contain structured replacements. `llm.ts` accepts an injected `StructuredModelClient`; it cannot redefine locations, symbols, parameters or evidence IDs. `validator.ts` rejects malformed output, unknown evidence, invented symbols/parameters and source files outside supplied snippets. `evaluation.ts` scores planning properties in a separate corpus.

The optional model boundary receives change metadata, selected facts, selected impacts, bounded snippets and migration instructions. It never receives the whole repository, unrelated files, `.env` contents, secret-like literals, lockfile contents, credentials or arbitrary filesystem access. No provider implementation or live model evaluation is configured in 0.3.0. A future provider must preserve the same compact request and structured output contract.

Target user: a Node.js/TypeScript maintainer investigating whether a known Stripe change touches their code. The user supplies a local checkout and optional structured change. APIProof returns evidence locations and potential impact. It performs no customer writes, network calls, repository installation, LLM calls, patch generation, sandbox execution, or GitHub operations.

Long-term product: change → affected code → official requirements → minimal diff → isolated verification → proof report → human-reviewed PR. Automatic merge and deployment are permanently forbidden product capabilities.

No database, auth, UI, Redis, or web/API server is needed to establish this milestone. Adding unused service/repository/database layers would obscure the current read-only pipeline. The filesystem snapshot is the input boundary, pure schema/provider logic is the domain boundary, and the CLI is the presentation boundary.

## Flow

1. CLI validates arguments and safely reads a bounded change JSON when requested.
2. Provider validates the change schema, provider/package identity, and SDK constraints before repository analysis.
3. Analyzer builds a deterministic, bounded repository snapshot. It does not load customer tsconfig extensions or compiler plugins.
4. Metadata reader inspects manifests, npm/pnpm locks, and optional installed Stripe manifests. Version provenance is preserved.
5. An in-memory ts-morph project creates source files only from that snapshot. Compiler symbols connect declarations, relative imports, aliases, typed properties and references. No customer dependency files are resolved from disk.
6. Binding resolution has cycle/depth protection, uses full AST spans as cache keys, and invalidates known reassigned bindings. Each usage carries the original binding location and nearest function/class context.
7. Stripe provider matches normalized member/type paths against exact or segment-prefix rules, then checks the originating binding's known SDK version. Unknown applicability remains a potential match with reduced confidence.
8. Core validates output, attaches change identity and an explicit not-run verification result. CLI emits JSON or safely escaped terminal text.

## Decisions

| Decision | Reason and consequence |
| --- | --- |
| TypeScript pnpm workspace | One toolchain and lockfile; five small packages make dependency boundaries visible |
| ts-morph | Compiler-backed scopes and locations without fragile source-text matching |
| In-memory project | Prevents implicit customer filesystem/dependency/config loading; sacrifices exports-map and tsconfig alias fidelity |
| Deterministic fixtures | Matching can be tested independently of ingestion; synthetic provenance prevents fictional advice from appearing authoritative |
| Zod inputs and outputs | Runtime validation at public boundaries plus inferred TypeScript models |
| Source conditions for development | CLI and typechecks work before builds; production exports use compiled JavaScript and declarations |
| Installed and locked versions separate | Avoids presenting a declared range or lockfile as an observed installation |
| One evidence-bearing finding per span | Stable IDs for review and deterministic comparisons; function/class context stays separate from source content |
| Read-only with fixed budgets | Bounded local work is easier to audit; exceeding hard traversal limits fails and skipped sources reduce coverage |
| Explicit inconclusive status | Detected gaps are surfaced; no claim of full migration safety is made |

## Security and audit

The analyzer has no mutation API and does not spawn subprocesses or make network requests. Only the CLI build/test tooling starts development subprocesses. User filenames, symbols, and change text are untrusted; terminal output removes control and format characters, while JSON preserves them escaped. Errors omit raw parser messages, source lines, stacks, and absolute customer paths. Reports still contain code identifiers and supplied change descriptions: treat them as repository-sensitive metadata.

Source symlinks are skipped. Installed package manifests are resolved and checked against the canonical root. Bounded reads account for files growing after `stat`. Root and nested JSON metadata, malformed/unsupported lockfiles, syntax errors, unknown exact versions, conflicting versions, and detected unsupported constructs have explicit outcomes. A stable local filesystem is assumed; this is not suitable as the sole boundary for hostile remote tenants.

Input content hashes, schema/tool versions, normalized change hashes, stable usage IDs, binding evidence, and matched rules support audit comparisons. Durable event storage, signed reports, exact Git revisions, process/container limits, and measured analyzer accuracy belong to later phases.

## Validation and remaining risks

Tests cover positive/negative fixtures, exact spans, scope shadowing, aliases, types, class and function contexts, CommonJS, cross-file/workspace clients, prefix boundaries, SDK filtering/uncertainty, schemas, CLI output/exit codes, locks, malformed metadata, symlinks, size limits, reproducibility and non-execution/non-mutation.

Risk: static analysis can miss code behind unsupported abstractions and over-report member references or type annotations. Confidence values measure evidence strength by policy and are not statistically calibrated. Mitigation: explicit scope/diagnostics, potential-impact wording, a future independently labeled corpus, and mandatory human review.

Risk: synchronous compiler work and finite file budgets limit very large repositories. Future improvement: incremental content-hash caching and per-package isolated workers, with deterministic aggregation. Do not remove budget guards merely to accept larger input.

Risk: package lock formats and compiler behavior change. Keep the committed lockfile, use frozen installs, and extend fixtures before adding format or syntax support. Do not infer version applicability from ranges alone or from unrelated pnpm snapshots.
