# Phase 2.5 deterministic hardening

Release 0.2.5 retains the existing CLI → core → generic analyzer/provider boundaries. This phase changes static evidence extraction, registry hygiene and evaluation only. There is no service, database, LLM or patch pipeline.

## Baseline and root causes

Before edits, all 94 tests passed and the actual evaluator reproduced TP17/FP1/TN17/FN3. The immutable result is `evaluation/results/phase2-baseline.json`.

| Permanent regression | Technical cause | Bounded correction |
| --- | --- | --- |
| false-positive-capability-check | Every non-callee bound member became a method usage, discarding the surrounding typeof/guard semantics | Generic expression classification preserves capability checks; behavior rules exclude them by default |
| false-negative-parameter-builder | Argument extraction accepted object literals/const aliases but stopped at every CallExpression | Follow repository-local function declarations/expressions/arrows with a straight-line return, including shallow aliases |
| false-negative-promise-field | Response resolution handled await and imported types but not a fulfillment parameter declaration | Connect only the first parameter of the first then callback to a proven provider Promise |
| false-negative-computed-method | Binding resolution accepted only StringLiteral element arguments | Resolve bounded immutable const string aliases, including as-const wrappers |

The four original source inputs and all 38 original labels are preserved. Evaluation tests compare their ground truth to the baseline and compare the four regression input digests. The new names live in `regressionId`; existing case IDs remain stable.

## Generic extraction and provider interpretation

`semantics.ts` classifies invocation, optional invocation, method reference, resource property access and capability checks. It recognizes guards, typeof, negation, null/undefined checks, unshadowed Boolean conversion and short-circuit boolean contexts. Ordinary method references remain conservative candidates. A rule must explicitly set `includeCapabilityChecks: true` to match a capability probe. Findings describe references as references rather than mislabeling them as calls.

`builders.ts` resolves a single local declaration with a body. It rejects async/generator functions, default/rest parameters, ambiguous declarations, reassignment, control-flow statements and unsafe preludes. Argument extraction follows at most **three builder calls**, with a shared cycle guard and the existing **20-step argument depth**. Only const preludes and one return are accepted. Nested helper calls are bounded; shallow const aliases and relative imports work. Arguments are not executed and parameter values are not substituted. Unknown branches, scalar forwarding, deep wrappers and unresolved returns stay incomplete. Presence predicates may use known keys; equality predicates still require complete literal evidence. Each propagated fact records the helper name, definition and call-site locations.

`responses.ts` keeps Promise provenance separate from fulfilled-value provenance. Direct provider calls and const Promise aliases can supply an inline arrow/function fulfillment callback or an awaited value. Rejection callbacks, local Promise lookalikes and transformed then chains are not promoted to provider responses. Callback location supplements the original method/binding evidence. Resolution remains bounded at **25 response steps** and **8 Promise alias steps**. `UNRESOLVED_PROMISE_CALLBACK` and `UNRESOLVED_RESPONSE_FLOW` explain unproven callbacks and response objects entering unmodeled helpers. Unknown third-party Promise callbacks can also lower coverage; this conservative diagnostic does not create an affected finding.

`static-values.ts` resolves string literals, const initializers, transparent assertions and shallow immutable aliases up to **8 steps**. Parameters, calls, conditional expressions, mutable variables and cycles remain unresolved. `DYNAMIC_MEMBER` is the explicit unresolved computed-provider-member code. The same resolver serves provider member bindings and response field access.

The analyzer contains no Stripe migration selectors. `rule-evidence.ts` interprets the generic semantics, parameter facts and response origins against reviewed Stripe rules. `scoreCases` supplies one policy for totals and both evaluation partitions.

## Confidence

Numeric confidence remains compatible in shape. It means **strength of static evidence that this repository usage is affected by this change**, never migration success, production safety, business risk or a calibrated probability.

Direct import/require binding starts at 0.95. Builder and Promise callback propagation cap extraction confidence at 0.90; type annotations cap at 0.85. The provider takes the minimum of extraction confidence and version confidence: exact declarations cap at 0.75, and unknown SDK or runtime API applicability at 0.70. No component was inflated. Components remain explainable through binding basis, propagation locations and version evidence, so a second numeric structure would add little value.

## Schema transition

- Tool/package release: 0.2.5. No dependency changes.
- Scan/impact output: 1.2, adding optional `semantics`, `arguments[].builders`, response callback locations and new evidence kinds. Numeric confidence and existing IDs remain. Current readers accept older scan/impact versions; older strict readers must upgrade before consuming 1.2.
- Corpus/result: 1.1. Every case requires provenance and one primary evidence pattern. Older corpus files need honest author/source attribution before use; there is no implicit review upgrade. Results include the same provenance, regression ID and category/pattern partitions.
- Registry records require a nonempty assumptions list. Draft rejection and human-only verified attribution remain enforced.

Independent review requires a distinct human reviewer in the label schema. These JSON attributes record an operator workflow, not authenticated signatures. The shipping corpus is entirely agent-authored and marked `authored`, with `reviewedBy: null`.

## Scaling, limits and future improvements

Finite traversal/input budgets, depth limits and cycle guards remain. All inference uses the existing in-memory snapshot; no customer dependencies, configuration plugins or code are loaded for execution. Independent snapshots can later run in isolated workers. A measured content-hash cache could reduce repeated scans without changing contracts.

Arbitrary factory and polymorphic return inference, transformed Promises, deep object/value flow, tsconfig resolution, full mutation/alias analysis and runtime API versions remain outside scope. Compiler property symbols resolve some simple factory-returned objects; that does not establish support for arbitrary factories. No reachability or dead-code elimination is claimed. Coverage describes supported static patterns, not migration safety.

Future improvements should be driven by independently reviewed examples and source-grounded negatives. Do not remove bounds or infer a provider from matching names to raise recall. A separately approved Phase 3 should initially be evidence-linked, read-only planning, with unresolved cases represented as explicit review tasks.

## Security review

No analyzer/core/provider code invokes subprocesses, customer functions, an LLM, networking, package installation, secrets access, git writes, PR creation or deployment. Existing path containment, symlink exclusions, file/byte budgets, redacted values, sanitized errors and read-only verification tests remain. Official source pages were manually inspected during development; runtime analysis never fetches those URLs or sends customer content anywhere. Local tooling tests/builds only APIProof. Manually authored installed-version fixture files contain package metadata, not downloaded customer dependencies.
