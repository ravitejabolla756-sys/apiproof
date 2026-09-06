# APIProof Phase 4 completion report

Release **0.4.0**, validated 2026-09-06. Phase 4 implements controlled candidate patch generation in disposable copies of APIProof-owned synthetic fixtures. Phase 5 has not started.

## Delivery

The implementation adds candidate/edit/status schemas, digest-bound executable registry rules, bounded patch context, deterministic and injected structured-model generators, a deterministic validator, an issued-workspace applicator, unified diffs, syntax parsing, CLI commands and a separate patch evaluation harness. Source responsibility and the full file list are recorded in [phase4-files.md](phase4-files.md).

TypeScript 5.9.3, already present in the toolchain, is now an explicit core runtime dependency for compiler-API parsing. The root and five workspace packages report 0.4.0. The existing CLI version assertion and analyzer audit schema were updated for this release; the other preexisting test contracts remain intact. No original advisory registry record or impact/planning corpus file changed.

## Required verification

All required commands passed:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test                         238 tests in 11 files
pnpm lint                         zero errors or warnings
pnpm build                        all five packages
pnpm apiproof evaluate
pnpm apiproof evaluate-plans
pnpm apiproof evaluate-patches
```

The 148 baseline tests remain passing, with the explicitly justified version assertion updated. Ninety tests were added. Source and compiled versions of all three evaluations match exactly. Source and compiled successful patch commands produce identical edits, file digests and diffs; run IDs and plan digests naturally differ. Both reject arbitrary repository targets and unconfigured model requests. The readable `pnpm apiproof patch` command also passed.

The generated unified diff passed `git apply --check --reverse` against its patched disposable workspace. This check did not apply a patch or modify files. No branch, commit or other Git write occurred. See [verification.json](../evaluation-patches/results/verification.json).

## Impact and planning regression

| Impact metric | Result |
| --- | ---: |
| True positives | 43 |
| False positives | 0 |
| True negatives | 29 |
| False negatives | 6 |
| Inconclusive cases | 9 |
| Analysis failures | 0 |

The six known analyzer limitations remain visible. Patch generation does not reinterpret them as proven impacts.

| Planning metric | Result |
| --- | ---: |
| Schema-valid plans | 6/6 |
| Exact affected locations | 6/6 |
| Correct statuses | 6/6 |
| Correct identities | 6/6 |
| Evidence validity | 100% |
| Unsupported fact inventions | 0 |
| Required-warning coverage | 100% |
| Planning failures | 0 |
| Insufficient-evidence cases | 2 |

Full regression artifacts: [impact](../evaluation-patches/results/evaluate-source.json), [planning](../evaluation-patches/results/evaluate-plans-source.json). Digest comparison against the preimplementation snapshots confirms the complete original impact and planning directories are unchanged.

## Patch evaluation

The patch corpus contains **24 cases across 12 distinct authored repositories**. Eight cases expect successful candidate patches: seven deterministic cases and one valid fake-provider case. Five cases explicitly require insufficient-evidence refusal. Eleven adversarial cases require rejection: ten malicious fake-model responses and one tampered candidate digest.

| Patch metric | Result |
| --- | ---: |
| Schema-valid patch reports | 24/24 — 100% |
| Correct statuses | 24/24 — 100% |
| Authorized files only | 24/24 — 100% |
| Expected supported transformations | 8/8 — 100% |
| Syntax-valid supported patches | 8/8 — 100% |
| Unexpected file modifications | 0 |
| Forbidden dependency modifications | 0 |
| Forbidden transformation rate | 0% |
| Corpus path/target safety rejections | 4/4 |
| Malicious fake-model rejections | 10/10 |
| Tampered candidate digest rejection | 1/1 |
| Total adversarial rejections without writes | 11/11 |
| Unsupported accepted fact inventions | 0 |
| Generation failures in normal evaluation | 0 |
| Harness failures | 0 |
| Original patch fixture changes | 0 |
| Supported deterministic baseline | 7/7 |
| Valid fake-model case | 1/1 |

The normal evaluation deliberately excludes unavailable-provider and thrown-provider tests from its generation-failure count; unit tests separately verify their explicit failure behavior. Rejected invention attempts are counted as rejections, not accepted facts. Refusal and attack cases are not included in supported transformation or syntax denominators.

Additional unit coverage includes 34 denied path forms and three accepted source-path forms; Windows reserved device names; source-content staleness; junction escapes; forged workspace/context handles; cross-workspace contexts; caller mutations; repeated application; unknown evidence; ranges and overlaps; semantic tampering; redaction; provider failure; bounded model inputs; syntax parsing without execution; and distant-edit unified hunks.

Full result: [evaluate-patches-source.json](../evaluation-patches/results/evaluate-patches-source.json), with identical [compiled evaluation](../evaluation-patches/results/evaluate-patches-compiled.json). These results measure an agent-authored synthetic corpus and do not establish production safety or independent human correctness.

## Supported cases and example

Supported deterministic cases are direct coupon create, coupon update using an identifier, promotion-code replacement, two affected calls in one file, the same migration in two files, `subscriptions.del` member rename and qualified `StripeContext` type rename. AST edits preserve other source text. Rules are stored in [transformations.json](../registry/patches/transformations.json), with explicit syntax/value semantics, source citations and change-digest binding.

```diff
-client.subscriptions.create({ coupon: 'launch' });
+client.subscriptions.create({ discounts: [{ coupon: 'launch' }] });
```

The [full candidate](../evaluation-patches/results/example-patch-source.json) records the plan/change/rule/source digests, evidence IDs, generator identity, run/workspace, edit operations, unified diff, validation stages and `requiresHumanReview: true`. The [standalone diff](../evaluation-patches/results/example.patch) is APIProof-generated.

The valid fake provider uses the identical authorized transformation contract. Its provenance identifies `fake-structured-patch-v1` and records `aiUsed: false`. **No live LLM call was made.** There is no configured external provider, and `--with-model` reports `MODEL_UNAVAILABLE` rather than manufacturing results.

## Rejected malicious example

The fake provider attempted this replacement at an otherwise valid affected property:

```ts
discounts: child_process.exec('unsafe')
```

The result was `PATCH_REJECTED` at the `dangerous-patterns` stage with `DANGEROUS_ADDITION`. It had no patched digest and no applied diff; workspace files remained unchanged. See [example-rejected.json](../evaluation-patches/results/example-rejected.json). Attempts to provide `../../README.md`, `.env` or package destinations fail the strict model schema because models cannot supply paths. Direct candidate path tampering is independently rejected by the path validator.

## Isolation and security confirmation

Every run checks the bundled fixture manifest and creates a fresh `.tmp/patch-runs/<UUID>/repository`. Only explicitly authorized source files in that disposable copy can be edited. Each candidate is checked against an internally retained context and file snapshot; originals are checked again. Workspace ancestors, symlinks/junctions, hard links, dependency files, forbidden paths and unexpected file-set changes are rejected.

Workspaces remain available for review and debugging. No cleanup command or caller-selected output directory is exposed. Validation artifacts were saved under `evaluation-patches/results` by the development verification workflow; the patch command itself does not write reports outside its workspace.

No customer repository was modified. No original fixture or evaluation corpus was modified by patching. No target application code, package scripts, tests, builds or dependency installations were executed. No secret files, live LLM, Git branches, commits, pushes, PRs, deployment or auto-merge were used. Candidate statuses and warnings explicitly retain human review and distinguish static validation from runtime verification.

## Limitations and Phase 5 recommendation

Response-field migration that requires choosing a subscription item remains unsupported. So do wrappers without exact provenance, registry changes without executable semantics, conflicting discount properties, spreads/computed keys, empty-string clearing and other unsupported AST shapes. Runtime identifier values, SDK/API applicability, cancellation options and application behavior require human review.

Model edits must match an authorized deterministic replacement exactly in Phase 4. No arbitrary model-only migration semantics or new dependencies are accepted. Secret detection is heuristic. Syntax validation does not perform project typechecking, execute the application, test behavior or verify external APIs. Workspaces are not an OS sandbox against hostile concurrent local processes; the tool bundle and process are trusted. A write failure may leave partial edits only in its disposable run and is reported as an apply failure.

The component separation and bounded context support independent fixture runs without widening analyzer trust. Before broader scale, add admission control, retention quotas and worker isolation. Before customer use, independently review rule semantics and ground truth and design a stronger filesystem/execution boundary.

**Recommendation:** ready to propose Phase 5 for separately approved isolated execution of these APIProof-owned fixtures. Phase 4 does not justify production/customer patching. Phase 5 has not been started automatically.
