# APIProof Phase 2.5 completion report

Release **0.2.5**, validated 2026-09-06. Phase 2.5 is complete within its bounded deterministic scope. Phase 3 has not started.

## Delivery and validation

**131 files: 94 added, 37 changed.** The [file inventory](phase2.5-files.md) lists exact paths, excluding installed tool dependencies and generated dist output. Changes cover generic AST semantics, bounded return/Promise/constant inference, provider evidence, registry assumptions, per-case provenance, evaluation partitions, regression tests and documentation. No dependencies were added.

All required checks passed:

- `pnpm install --frozen-lockfile`: lockfile unchanged, lifecycle scripts disabled.
- `pnpm typecheck`: workspace packages and tests pass.
- `pnpm test`: **138 tests passing in 8 files**, up from 94.
- `pnpm lint`: zero warnings/errors.
- `pnpm build`: all five packages build.
- `pnpm apiproof evaluate`: all 78 cases scored, exit 0.
- Compiled CLI evaluation, impact, scan and version commands pass. Source and compiled evaluation JSON are structurally identical, including all digests, predictions, provenance and breakdowns.

Windows sandbox restrictions initially blocked toolchain worker spawning (EPERM). Authorized local tooling runs completed successfully; no customer execution permissions were added.

## Corpus and actual results

**55 authored repositories**, **78 labeled repository/change cases**, **9 Stripe change records**. Labels: 49 positives, 29 negatives, 52 expected affected usages. All original 38 case IDs/labels remain; 25 repositories and 40 cases were added.

| Metric | Case level | Usage level |
| --- | ---: | ---: |
| True positives | 43 | 46 |
| False positives | 0 | 0 |
| True negatives | 29 | Not defined |
| False negatives | 6 | 6 |
| Precision | **100.00%** | **100.00%** |
| Recall | **87.76%** | **88.46%** |
| F1 | **93.48%** | **93.88%** |

**9 inconclusive cases; 0 analysis failures.** Inconclusives remain scored. None was excluded to improve scores. Usage matching uses exact file, line, column and canonical symbol.

Precision and F1 meet the desired 95%/93% thresholds; recall is **below 92%**. This is truthful performance on a harder authored corpus, not independent production accuracy. Correlated cases and overlapping change records prevent broad statistical conclusions.

Machine-readable results: [source evaluation](../evaluation/results/latest.json), [compiled evaluation](../evaluation/results/phase2.5-compiled.json), [builder impact example](../evaluation/results/phase2.5-example-impact.json), [compiled scan](../evaluation/results/phase2.5-compiled-scan.json). The [Phase 2 baseline](../evaluation/results/phase2-baseline.json) is retained.

## Metrics by change category

| Category/pattern | Cases | TP | FP | TN | FN | Precision | Recall | F1 | Usage P/R/F1 | Inconclusive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| method-removed | 25 | 15 | 0 | 7 | 3 | 100.00% | 83.33% | 90.91% | 100.00% / 85.00% / 91.89% | 4 |
| parameter-changed | 3 | 1 | 0 | 2 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| parameter-removed | 21 | 11 | 0 | 9 | 1 | 100.00% | 91.67% | 95.65% | 100.00% / 91.67% / 95.65% | 2 |
| parameter-renamed | 2 | 1 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| resource-removed | 3 | 2 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| response-field-changed | 19 | 10 | 0 | 7 | 2 | 100.00% | 83.33% | 90.91% | 100.00% / 84.62% / 91.67% | 3 |
| symbol-deprecated | 2 | 1 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| type-changed | 3 | 2 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |

## Metrics by primary evidence pattern

Each case belongs to exactly one category and one primary pattern. These are computed partitions, not hand-selected subsets. All groups have zero analysis failures. Negative-only groups have undefined rates, shown as n/a.

| Category/pattern | Cases | TP | FP | TN | FN | Precision | Recall | F1 | Usage P/R/F1 | Inconclusive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| capability-check | 2 | 0 | 0 | 2 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 0 |
| class-client | 4 | 3 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| client-alias | 3 | 2 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| computed-method | 3 | 3 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| conditional-builder | 1 | 0 | 0 | 1 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 1 |
| deep-builder | 1 | 0 | 0 | 0 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 1 |
| deep-dataflow | 1 | 0 | 0 | 0 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 1 |
| direct-method-call | 10 | 6 | 0 | 4 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| direct-parameter | 14 | 6 | 0 | 8 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| dynamic-import | 1 | 0 | 0 | 0 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 1 |
| factory-abstraction | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| installed-unused | 1 | 0 | 0 | 1 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 0 |
| multi-file | 2 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| optional-invocation | 2 | 2 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| parameter-builder | 4 | 4 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| path-alias | 1 | 0 | 0 | 0 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 1 |
| polymorphic-wrapper | 1 | 0 | 0 | 0 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 1 |
| promise-callback | 4 | 4 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| promise-collision | 1 | 0 | 0 | 1 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 1 |
| response-field | 8 | 6 | 0 | 2 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| runtime-api-version | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| runtime-computed | 2 | 0 | 0 | 1 | 1 | n/a | 0.00% | 0.00% | n/a / 0.00% / 0.00% | 2 |
| type-collision | 2 | 0 | 0 | 2 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 0 |
| type-reference | 3 | 2 | 0 | 1 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| unconnected-helper | 2 | 0 | 0 | 2 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 0 |
| unknown-version | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% | 100.00% | 100.00% / 100.00% / 100.00% | 0 |
| unrelated-binding | 2 | 0 | 0 | 2 | 0 | n/a | n/a | n/a | n/a / n/a / n/a | 0 |

## Permanent regressions

| Permanent ID | Phase 2 | Phase 2.5 |
| --- | --- | --- |
| false-negative-parameter-builder | FN | TP |
| false-negative-promise-field | FN | TP |
| false-negative-computed-method | FN | TP |
| false-positive-capability-check | FP | TN |

The original optional-member cast, builder body, Promise expression and computed identifier are unchanged. Tests protect their input digests and every original expected affected flag/usage. Technical causes and bounded fixes are in [the design note](phase2.5-design.md).

## Remaining errors and uncertainty

There are **no remaining false positives or extra usage predictions in this corpus**. Each of these six cases has one missed affected usage:

- `runtime-computed-invoice-upcoming-removed`: DYNAMIC_MEMBER.
- `dynamic-import-client-invoice-upcoming-removed`: DYNAMIC_IMPORT.
- `deep-builders-subscription-coupon-removed`: INSUFFICIENT_STATIC_EVIDENCE.
- `unresolved-path-alias-invoice-upcoming-removed`: UNRESOLVED_IMPORT_ALIAS.
- `deep-response-flow-subscription-period-fields`: UNRESOLVED_RESPONSE_FLOW.
- `polymorphic-response-subscription-period-fields`: UNRESOLVED_PROMISE_CALLBACK, UNRESOLVED_RESPONSE_FLOW.

All six now report inconclusive coverage. Runtime keys, dynamic imports, five-deep builders, customer path aliases, nested generic response wrappers and transformed Promise chains account for the recall deficit. Broad whole-program inference would exceed the authorized narrow phase.

The nine inconclusive cases are:

- `runtime-computed-invoice-upcoming-removed` (FN).
- `dynamic-import-client-invoice-upcoming-removed` (FN).
- `deep-builders-subscription-coupon-removed` (FN).
- `unresolved-path-alias-invoice-upcoming-removed` (FN).
- `deep-response-flow-subscription-period-fields` (FN).
- `polymorphic-response-subscription-period-fields` (FN).
- `promise-field-collision-subscription-period-fields` (TN).
- `computed-factory-modern-invoice-upcoming-removed` (TN).
- `conditional-modern-builder-subscription-coupon-removed` (TN).

The three inconclusive negatives are a computed factory returning the modern preview method, a conditional builder whose branches are modern, and unrelated Promise field collisions. The analyzer abstains rather than guessing. Runtime-selected API-version cases can produce potential impacts while retaining `API_VERSION_UNVERIFIED` and a confidence cap; this is separate from inconclusive-no-match status.

Other limitations remain: arbitrary factories and polymorphic clients, package export maps/project references, complete mutation/alias propagation, conditional/default parameter values, nested argument arrays, JavaScript-only projects, semantic compilation, runtime reachability and API behavior. Some simple factory properties resolve through compiler symbols; that is not arbitrary factory support. Not every unsupported construct is detectable.

## Registry and provenance

All **9 records are reviewed, 0 verified, 0 draft**, following manual inspection of official source pages. [The review ledger](phase2.5-registry-review.md) links each inspected source and records its scope. Every record separates source URL/summary, package and SDK/API scope, symbols/rules, migration instructions, assumptions and attributed review. SDK cohorts are explicit assumptions rather than claims about all historical versions. Legacy usage guidance now acknowledges the documented pinned-version RawRequest transition.

All **78 labels are agent-authored synthetic development cases**, status authored, reviewedBy null. There are **0 independent human approvals and 0 externally derived cases**. Required attribution fields and a human-only independent-review gate allow a future expert to review labels without changing format. Review attributes are operator-maintained metadata, not signatures.

## Architecture, scaling and security

Generic TypeScript facts stay in the analyzer; Stripe rules and version interpretation stay in the provider; scoring stays in core. Small modules preserve the existing architecture. Depth/cycle guards, snapshot budgets, local source binding and read-only analysis remain. Confidence is static affected-evidence strength, with propagated evidence capped at 0.90 before existing version caps; it is not migration-success probability or production safety.

No customer code was executed or modified, no LLM was integrated/invoked by APIProof, and no customer content was sent to an external service. No customer dependencies were installed. No secrets were accessed, branches/commits/PRs created, or deployments performed. Existing filesystem containment, exclusion, redaction, reproducibility and non-execution tests pass. Only APIProof code, authored fixtures, registry data, reports and documentation changed.

## Phase 3 recommendation

**Ready for a separate Phase 3 design review focused on evidence-linked, read-only migration planning; not ready for autonomous patches or claims of production migration safety.** Independent Stripe/API-expert review of registry records and labels, plus rights-approved held-out integration examples, should precede production accuracy claims.

Plans should carry unresolved coverage, target SDK/API versions, source evidence and explicit verification tasks. The six misses must remain visible. Any future code modification or execution requires a separately reviewed scope. Phase 3 has not been started.
