# Stripe integration evaluation corpus

This corpus contains **55 authored integration repositories**, **78 manually specified repository/change labels**, and **9 referenced registry records**. There are 49 positive cases and 29 negative cases, covering 52 expected affected usages. These are small source examples written for APIProof, not customer repositories, independent human labels, or a statistically representative production sample.

The source inputs model subscription cancellation, billing services, discounts, invoice previews, subscription periods, Checkout shipping, account onboarding, metering, and context types. They include client aliases, class members, relative imports, multiple clients, metadata lookalikes, dynamic calls, and unsupported response flows. Several deliberately include old or new SDK syntax around an upgrade boundary; they are analysis inputs, not deployable applications. Their minimal lockfiles carry version evidence only. They are excluded from workspace installation, source typechecking and linting, like the Phase 1 test fixtures.

## Reproduce

```sh
pnpm --silent apiproof evaluate
pnpm --silent apiproof evaluate --json
pnpm --silent apiproof evaluate --json > evaluation/results/latest.json
```

The evaluator itself writes nothing. The final command explicitly redirects output into this tool's results directory. Custom datasets use `--corpus <directory>` and an optional `--registry <directory>`.

## Ground truth and safeguards

- `labels/cases.json` is the source of truth. Every case gives a repository, change ID, affected boolean, precise file/line/column/symbol labels, rationale, primary evidence pattern and provenance. Schema 1.1 requires authoredBy, reviewedBy, reviewStatus, createdAt, sourceBasis, origin (synthetic or externally-derived) and notes inside `provenance`.
- All 78 shipped cases have an agent author, `reviewStatus: authored`, `reviewedBy: null` and synthetic origin. A future reviewer can update these fields without changing the format; independently-reviewed status requires a distinct human reviewer. Attributes are not cryptographically authenticated approvals.
- Expected impacts were selected from source semantics and documented change scopes before running the evaluator. Locations were computed from manually selected text anchors, without using analyzer findings. Author/reviewer attribution is recorded as `agent`; there is no invented human approval.
- Positive labels must have usages, negatives must not. Duplicate case IDs, duplicate repository/change pairs, duplicate expected usages, escaping paths, and out-of-bounds source positions are rejected. Records must be reviewed or verified.
- No labels, corpus sources, or change records are generated or modified during evaluation. There are no network requests, package installs, or customer-code executions.
- The result includes normalized label and change digests, each source snapshot digest, predictions, missed/unexpected usages, diagnostics, and per-case outcomes.

## Metric definitions

**Case-level metrics** classify each explicitly labeled repository/change pair: TP = affected and detected; FP = unaffected but detected; TN = unaffected and not detected; FN = affected but not detected. The displayed repository count counts distinct repositories, not case denominators. Labels do not enumerate every possible cross-product of repositories and changes.

Precision = TP / (TP + FP); recall = TP / (TP + FN); F1 = 2TP / (2TP + FP + FN). Undefined denominators are JSON `null` and terminal `n/a`. Scores are computed from actual outcomes, never constants.

**Usage-level metrics** use one-to-one set matching on exact file, line, column, and canonical symbol within each case/change. Repeated prediction entries do not earn extra credit. Missing positions are FN; unexpected positions are FP. There is no meaningful enumerable universe of usage-level true negatives, so none is reported.

Inconclusive scans remain in the scored case denominator, with their observed predictions. A missed affected usage is still an FN. A failed analysis is an `ERROR` with a null prediction, excluded from scores and counted separately; the CLI exits 1 if any occur. It never credits a failure as a true negative. `scoredCases` exposes the denominator. Malformed input aborts the evaluation.

## Known error cases retained in the corpus

| Example | Ground truth | Why it is challenging |
| --- | --- | --- |
| discounts-builder | Affected; now TP | false-negative-parameter-builder: bounded object-return propagation |
| period-promise | Affected; now TP | false-negative-promise-field: proven fulfillment parameter |
| dynamic-member | Affected; now TP | false-negative-computed-method: immutable string resolution |
| retained-reference | Unaffected; now TN | false-positive-capability-check: original optional-member typeof probe retained |

All 38 original labels are retained and checked against `results/phase2-baseline.json`. The four regression input digests must remain unchanged. The saved run in `results/latest.json` and [Phase 2.5 report](../docs/phase2.5-results.md) show the expanded results; `results/phase2.5-compiled.json` independently runs the built CLI and is identical to the source result. This is a development regression corpus, not a held-out benchmark. Related examples and overlapping deprecation/removal records make cases correlated. Before making production accuracy claims, add independently labeled, rights-approved real integrations and a held-out set.

`byChangeCategory` and `byEvidencePattern` use the same scoring function as overall totals. Each is a partition: one record category and one primary pattern per case, including negatives. JSON and terminal output include counts, case/usage scores, inconclusives and failures. A negative-only group has undefined precision/recall/F1 (`null`/`n/a`), not an invented 100%.

Remaining difficult cases include runtime-computed members, dynamic imports, deep builders, path aliases, nested response dataflow and polymorphic Promise wrappers. All six missed cases are scored as FN and reported inconclusive. Runtime-selected API versions retain potential findings with explicit applicability uncertainty. Some simple factory object properties resolve through compiler symbols; arbitrary factory support is not claimed. Manually authored `node_modules/stripe/package.json` files in installed-unused and post-upgrade contain metadata only and test observed-version handling without installing dependencies.

Review correction: the initial capability-probe source omitted its explicit optional-member type. An uncast reference could itself become a TypeScript error after upgrading, contradicting the intended negative label. The source now expresses the compatibility contract explicitly; the negative label is unchanged. This correction preserves the challenging false-positive case rather than counting an incorrectly labeled typing break as a negative.
