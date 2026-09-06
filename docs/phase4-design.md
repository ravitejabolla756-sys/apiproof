# Phase 4: controlled fixture patch generation

Release 0.4.0 adds candidate source edits after the Phase 3 planning boundary. It does not establish that a migration behaves correctly at runtime.

## Baseline and permitted writes

Before implementation, all 148 Phase 3 tests passed. Impact evaluation remained TP 43 / FP 0 / TN 29 / FN 6. Planning evaluation remained 6/6 schema-valid, exact locations, correct statuses and identities; evidence validity and required-warning coverage 100%; no inventions or failures; two insufficient-evidence cases. The Windows test runner required an unsandboxed retry after `spawn EPERM`. No fixture scripts were invoked.

The patch runtime recognizes only the exact bundled repositories listed in `evaluation-patches/manifest.json`, resolved relative to the installed APIProof code. The manifest records the complete file set and SHA-256 digests. A same-named folder elsewhere, an extra file, a changed fixture, a symlink/junction or a hard-linked file is refused. Neither CLI flags nor model output can configure the corpus, registry or output root.

The only runtime source-write destination is:

```text
<APIProof root>/.tmp/patch-runs/<generated UUID>/repository/src/**/*.ts
<APIProof root>/.tmp/patch-runs/<generated UUID>/repository/src/**/*.tsx
```

Workspace creation also copies manifest-approved package metadata into that new repository. Patches cannot modify it. Workspaces are retained for debugging; there is no automatic recursive cleanup or caller-selected output directory. APIProof development source, documentation and evaluation artifacts were authored as part of this implementation; generated migration patches cannot target them.

## Component responsibilities

```text
Bundled fixture identity and immutable snapshot
  → fresh disposable copy
  → existing analyzer and Phase 3 planner
  → validated plan + patch context builder
  → deterministic generator or injected structured model
  → candidate schema and deterministic policy validator
  → capability-bound workspace applicator
  → TypeScript syntax checks and digest verification
  → candidate report requiring human review
```

`packages/shared/src/patching.ts` owns contracts. Core patching separates workspace lifecycle, path/secret policy, registry loading, AST transformations, context building, generation, validation, diff generation, application and evaluation. The CLI formats reports and selects only bundled inputs. No GitHub adapter or execution agent participates.

## Executable transformation registry

`registry/patches/transformations.json` is separate from the existing advisory registry. Each entry contains schema-validated executable semantics, source citations, limitations and the digest of the reviewed change record. Changing a reviewed record invalidates its patch rule until the rule is reviewed and rebound. Existing impact and planning records remain unchanged.

Supported primitives:

- Singleton discount: replace an inline `coupon: value` or `promotion_code: value` property with `discounts: [{ coupon: value }]` or the corresponding promotion-code entry. The rule explicitly defines the destination, nested shape, value policy and conflicting properties. Only identifier-named object properties with a nonempty string literal or identifier value are accepted. Spreads, computed keys, duplicates, conflicting discounts, empty-string clearing, shorthand properties and effectful expressions refuse generation.
- Member rename: replace only the evidence-linked `subscriptions.del` member token with `cancel`, preserving the call and arguments.
- Qualified type rename: replace only the affected `StripeContext` type token with `StripeContextType`. Constructor expressions remain untouched.

The coupon shape was checked against the [Basil change advisory](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-singular-coupon-promotion-code) and the [tagged v18 subscription declarations](https://raw.githubusercontent.com/stripe/stripe-node/v18.0.0/types/SubscriptionsResource.d.ts). These are agent-authored rules, not independently human-verified migrations. Identifier values, cancellation options and business behavior still need review.

Response period migration has no executable rule: selecting a subscription item requires business context. It is an explicit refusal fixture. Unsupported wrappers and records without exact semantics also return `PATCH_INSUFFICIENT_EVIDENCE`. No model is invoked when the plan is insufficient or when any affected usage lacks an authorized transformation; partial migrations are not silently emitted.

## Context and model boundary

The model receives a validated redacted plan, exact authorized edit targets, bounded nearby snippets and the selected structured transformation. Surrounding context is bounded to 300 characters on either side of each target, 24,000 characters of snippets and 64,000 characters for the aggregate request context. Large or secret-intersecting edit targets cause refusal.

Phase 3 redaction is inherited and supplemented for common environment expressions, credential assignments, Stripe-like literals, bearer values, JWT-like values, GitHub tokens and AWS key IDs. Redaction is heuristic, not perfect secret detection. The context builder never reads `.env`, unrelated source files, credential stores or lockfile text for model input. An actual edit intersecting secret-like material is refused. Secret-like surrounding diff context is omitted; if it cannot be omitted safely, the patch is rejected.

The provider accepts no filesystem handle, repository root, tools or directory listing. Output is strictly `{ edits: [{ targetId, replacement, evidenceIds }] }`. APIProof derives paths, ranges, expected original text, digests and diffs. Fake providers exercise both valid output and attacks. An external provider can be injected through `StructuredPatchModel`, but there is no bundled live transport or configured model. CLI `--with-model` returns `MODEL_UNAVAILABLE`.

The Phase 4 semantic check deliberately requires the model replacement to equal the authorized deterministic transformation. It is not an AI judge. This limits model usefulness but prevents a model from broadening migration semantics before execution isolation exists.

## Validator and applicator

Stages report structured pass/fail results. Later stages are omitted after a failure; omitted means not reached, not passed.

1. Strict candidate/model schema and mandatory `requiresHumanReview: true`.
2. Patch, repository, run, plan, change and transformation-registry provenance.
3. Evidence IDs and immutable affected-source digests.
4. Portable relative source-path allowlist, including Windows device-name exclusions.
5. Evidence-authorized file set, exact AST ranges and expected source text.
6. Conservative size policy: default five files, 150 changed lines, 25 edits and 8,000 replacement characters per edit. Typed caller configuration can lower limits or raise edit count to 50 and replacement size to 16,000 within fixed hard ceilings.
7. Secret-like output, dangerous primitives and exact semantic correspondence, including complete target coverage and no overlap.
8. Revalidate the issued workspace, original fixtures and the entire copied snapshot immediately before application.
9. Parse all proposed TypeScript before writing. Apply using checked file handles, verify digests and the complete file set afterwards, and record syntax validation.

Workspaces and authorized contexts have process-local issuance records. A forged handle, cross-workspace context or caller-mutated context cannot authorize writes. Each source file is rechecked through its opened handle; symlinks, junctions and hard links are refused. Diff generation creates standard unified hunks from edit ranges, keeping distant edits separate and preserving CRLF text and missing-terminal-newline markers.

`PATCH_READY_FOR_VALIDATION` means a candidate passed these static checks and was applied to its disposable fixture copy. It never means runtime verification. Refusals, policy rejection, generation failure, apply failure and syntax failure have distinct statuses. A write failure can leave a partially modified disposable run; the report flags this and instructs the reviewer to discard it. Originals are never used as rollback targets.

## Evaluation, scaling and limitations

The independent patch corpus has 24 labeled cases across 12 authored repository fixtures. Labels specify statuses, expected files, required/forbidden source fragments and immutable dependency files. Evaluation reads actual workspace files and original digests rather than trusting candidate claims. It separately counts deterministic successes, fake-model successes, path attacks, stale-digest handling, unsupported output, syntax checks and harness failures. Any correctness failure makes the CLI exit nonzero. There is no production-safety score.

The registry and generator are stateless; isolated UUID workspaces permit independent runs. Context and fixture sizes are bounded, and AST parsing touches only authorized source. This is suitable for a controlled evaluation service, not evidence that millions of migrations can run on one host. A future service needs admission control, retention quotas, worker isolation and cancellation before accepting untrusted execution.

This filesystem policy is not an OS security sandbox against a hostile local process concurrently replacing ancestors. The bundle, manifest and process are trusted. There are no customer inputs, customer execution, dependency installations in targets, project typechecking, target tests, API calls, branches, commits, pushes, PRs, merges or deployments. Phase 5 requires separate approval and execution-isolation design.
