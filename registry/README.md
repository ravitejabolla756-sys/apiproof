# Reviewed Stripe change registry

Records are curated JSON, not scraped content. Every record carries official source URLs, concise evidence summaries, review attribution, version scope, category-specific rules, migration guidance and a separate nonempty assumptions list. Canonical records live in `stripe/`. The evaluator refers to their IDs rather than copying them. All nine were reinspected in Phase 2.5; see [the review ledger](../docs/phase2.5-registry-review.md).

## Review lifecycle

1. **draft** — collect a candidate, scope its affected source SDK range, and write defensible rules. Drafts may be stored/listed, but impact analysis and evaluation reject them.
2. **reviewed** — the named reviewer has checked the sources, selectors, argument positions, interpretation, and positive/negative examples. Both human and explicitly attributed development-agent source reviews are represented.
3. **verified** — independent human verification is recorded. An agent cannot label its review verified; schema validation rejects that combination.

The nine shipped records were individually source-reviewed by **Codex**, not independently approved by a human. They are `reviewed`, never `verified`. This is transparent development provenance, not a signature, authentication mechanism, or proof that the vendor's statement was reproduced in a running integration. Before production rollout, an independent maintainer should review the records and corpus labels. Editing a JSON status is an operator workflow; this phase has no approval UI or immutable review service.

`--change-id` and official `--change` records always pass the review gate. Legacy synthetic fixtures remain available for Phase 1 compatibility, report `analysisMode: fixture`, and cannot enter evaluation. Production-style records report `analysisMode: reviewed-registry`.

## Rules and version interpretation

`rules` is authoritative for matching. `affectedSymbols` and `resources` are compact discovery metadata. Parameter names, argument indices, response fields/types, and literal predicates are expressed in the rules rather than duplicated in several independently editable lists. A finding records the rule index, its readable identifier, stable reason codes, source/binding locations, and evidence URLs.

- `method` and `resource`: exact or dot-boundary prefix matching against a proven client binding. Method references remain conservative candidates; capability checks require explicit `includeCapabilityChecks: true`. None of the nine records opts in.
- `parameter`: a named property at a zero-based argument index, optionally equal to a documented literal value. Nested literal objects, known const spreads and bounded local builders are inspected. Unresolved input shapes are inconclusive.
- `response-field`: exact field paths on awaited responses, proven Promise fulfillment callbacks or explicitly imported types. The provider record lists the relevant producing methods and types.
- `type`: imported or namespace-qualified type usage; expression-only constructor references are separate.

Change categories describe the migration (removal, rename, type change, deprecation, etc.); rules describe observable evidence. For example, a parameter rename can require a value-shape transformation rather than a mechanical key rename.

`affectedSdkVersions` describes the **source upgrade cohort** under review. These records do not claim to cover every historical SDK version or every alternative endpoint in a vendor advisory. `targetSdkVersion` identifies the proposed upgrade. Known out-of-scope SDKs are excluded with reason codes. API-specific changes record `apiVersion` separately; account, webhook, client and request API-version overrides are not inferred, and API applicability remains explicitly unverified.

## Initial coverage

| Record suffix | Category | Narrow scope |
| --- | --- | --- |
| subscriptions-del-removed | Removed method | Legacy del helper before SDK 13 |
| subscriptions-del-deprecated | Deprecated symbol | Advisory for the same legacy helper |
| checkout-shipping-rates-renamed | Replaced parameter | Checkout create shipping_rates before SDK 13 |
| account-link-type-changed | Changed parameter | Two removed account-link enum values |
| invoice-upcoming-removed | Removed methods | Two upcoming invoice helpers, SDK 17 → 18 |
| subscription-coupon-removed | Removed parameters | Singular coupon/promotion_code on subscription create/update |
| subscription-period-fields | Changed response fields | Top-level Subscription periods, SDK 17 → 18 |
| context-type-renamed | Changed imported type | StripeContext annotation, SDK 21 → 22 |
| legacy-usage-methods | Removed resource operations | Two legacy subscription-item usage helpers |

The method-removal and deprecation records intentionally overlap; evaluation treats each repository/change pair as its own case. This correlation is disclosed and does not constitute nine independent vendor migrations.

Unsupported rule semantics: implicit/default parameter changes, arbitrary value transformations, arrays of nested objects, semantic equivalence of expressions, general interprocedural response flow, and automatic runtime API-version inference. New categories should add extraction and negative regressions before records are promoted.
