# APIProof Phase 2 completion report

Release: **0.2.0**. Scope: read-only impact detection and evaluation. Phase 3 has not started.

## Files and architecture

See the [added/changed file inventory](phase2-files.md). New modules cover rule/review/evaluation schemas, bounded JSON inputs, generic argument and response extraction, Stripe registry validation, provider rule interpretation, version assessment, and evaluation metrics. New data covers nine canonical registry records and a separately labeled corpus. Saved outputs are [evaluation JSON](../evaluation/results/latest.json) and [example impact JSON](../evaluation/results/example-impact.json).

The existing package architecture is preserved:

```text
Bounded repository parsing
  -> generic TypeScript binding and usage facts
  -> Stripe rule interpretation and version assessment
  -> structured impact evidence
  -> independent label comparison and metrics
```

The language analyzer contains no Stripe migration rules. The core evaluator depends on an injected impact runner. No new dependencies, databases, services, or external integrations were added. Source and metadata budgets remain in effect; new fact resolvers have depth/cycle guards. Registry loading caps at 100 records and labels at 1,000 cases. Future per-revision scan caching can reduce repeated work after profiling.

## Validation

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; no dependency changes |
| `pnpm typecheck` | Passed |
| `pnpm test` | **94 tests passed in 7 files** |
| `pnpm lint` | Passed |
| `pnpm build` | Passed |
| Development and compiled evaluation CLI | Passed |
| Compiled reviewed-change impact CLI | Passed |

The original 51 regression cases remain. The CLI version expectation advances from 0.1.0 to 0.2.0 for this release; behavior assertions were not weakened. The additional tests cover review gates and provenance, malformed records, class clients, aliases, parameters, response fields/types, false positives, literal predicates, version uncertainty, metric math, corpus integrity, failure accounting, and exclusion of sensitive paths. Repositories are never executed or modified by analysis.

## Actual evaluation

Dataset: `stripe-integrations-v1`, **30 authored repositories**, **9 change records**, **38 repository/change cases**. Labels comprise 20 positive cases, 18 negatives, and 21 expected affected usages. All 38 cases were scored. There were **2 inconclusive cases and 0 failed cases**.

| Metric | Case level | Usage level |
| --- | ---: | ---: |
| True positives | 17 | 18 |
| False positives | 1 | 1 |
| True negatives | 17 | Not defined |
| False negatives | 3 | 3 |
| Precision | **94.44%** | **94.74%** |
| Recall | **85.00%** | **85.71%** |
| F1 | **89.47%** | **90.00%** |

Metrics are calculated from predictions, not hardcoded. JSON retains full precision and per-case misses/extra findings. Usage matching requires exact file/line/column and canonical symbol within the labeled change. Inconclusive cases remain scored; failed analyses would be reported separately, excluded from scores, and cause exit code 1.

## False positives and false negatives

**False positive:** `retained-reference` uses an explicit optional-member type and a `typeof` capability probe. The probe remains valid when the legacy method disappears. The analyzer conservatively treats the bound member reference as affected. A future distinction between invocation, capability testing and other reference contexts could reduce this error.

**False negatives:**

1. `discounts-builder`: a function constructs the coupon parameters. Arbitrary function-return inference is unsupported; the result is inconclusive but still counts as an FN.
2. `period-promise`: a `.then()` callback receives a subscription and reads its removed period field. Callback result inference is unsupported; this currently produces no match without detecting that gap.
3. `dynamic-member`: a computed identifier names `retrieveUpcoming`. The analyzer reports a dynamic-member gap and an inconclusive result; the missed usage still counts as an FN.

These cases remain in the corpus. A source-review correction made the capability probe's optional-member typing explicit; an uncast expression could fail target SDK typechecking and would not be a valid negative. This is documented in the corpus README, and its false positive remains in the final run.

## Evidence and example output

```sh
pnpm apiproof impact evaluation/corpus/discounts-update --change-id stripe-subscription-coupon-removed --json
```

Selected fields from the saved impact:

```json
{
  "changeId": "stripe-subscription-coupon-removed",
  "affected": true,
  "symbol": "subscriptions.update",
  "confidence": 0.7,
  "versionAssessment": "in-range",
  "reasonCodes": [
    "AFFECTED_PARAMETER_PRESENT",
    "VERSION_IN_AFFECTED_RANGE",
    "API_VERSION_UNVERIFIED"
  ]
}
```

The full finding identifies the method at `src/index.ts:4:10`, the `coupon` argument-property location, import binding, lockfile SDK version, matched rule/index and official sources. The confidence cap reflects unverified runtime API-version applicability, not migration safety. Literal argument values and source snippets are omitted.

```text
APIProof Evaluation

Repositories: 30
Change records: 9
Ground-truth cases: 38

True positives: 17
False positives: 1
True negatives: 17
False negatives: 3

Precision: 94.4%
Recall:    85.0%
F1:        89.5%
```

## Limits and review status

This establishes measurable accuracy on an authored development corpus, **not general production accuracy**. The records and labels have explicit Codex source-review attribution, not independent human verification. Examples are correlated, the deprecated/removed helper records overlap, and there is no held-out real-repository cohort. Confidence values are evidence-strength policies, not calibrated probabilities.

Unsupported patterns include arbitrary interprocedural dataflow, Promise callback response inference, computed member identifiers, tsconfig path aliases, package export maps, nested argument arrays, general mutation propagation, and implicit/default parameter behavior changes. Not every unsupported pattern produces a diagnostic. API versions on accounts, webhook endpoints, clients and individual requests are not established. SDK ranges describe scoped source upgrade cohorts; the tool is not a general detector of every unsupported call after an upgrade.

Review records are operator-controlled JSON with `draft -> reviewed -> verified` semantics. Drafts are rejected; agent-attributed records cannot claim verified status. These markers are not authenticated approvals. File/path budgets and read-only behavior are also not an OS isolation boundary against actively hostile filesystem mutation.

## Recommended Phase 3

First review this accuracy report, independently check registry records and labels, and add rights-approved real integration samples with a held-out set. Prioritize bounded Promise-result inference and distinguishing capability checks from invocations. Then design **read-only migration plans** linking proposed steps to source evidence, target SDK/API versions, unsupported cases, and explicit verification requirements. Consider minimum-context LLM reasoning only after agreement on those gates. Patch generation, customer code execution, commits, GitHub access, PR creation, merges and deployment remain outside this implementation.
