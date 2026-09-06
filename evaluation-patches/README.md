# Authored patch evaluation corpus

This corpus is independent of `evaluation` and `evaluation-plans`. Its 24 cases use 12 immutable synthetic repositories. `manifest.json` authorizes their exact paths, complete file sets and SHA-256 digests. Runtime patching refuses changed fixtures and always copies into a fresh `.tmp/patch-runs/<UUID>/repository`.

Run from the APIProof root:

```sh
pnpm apiproof evaluate-patches
pnpm apiproof evaluate-patches --json
pnpm apiproof patch evaluation-patches/corpus/coupon-basic --change-id stripe-subscription-coupon-removed
node apps/cli/dist/index.js evaluate-patches --json
```

Seven supported deterministic cases cover coupon create, coupon update with an identifier, promotion code, two calls in one file, two files, method rename and qualified type rename. One fake-model success exercises the same authorization path. Five refusal cases cover response item selection, an unsupported wrapper, missing exact semantics, existing discounts and empty-string clearing. Ten malicious fake-model cases cover traversal, `.env`, dependencies, unauthorized targets, dangerous primitives, whole-file rewriting, nonexistent evidence, oversized output, invented dependencies and malformed syntax. One additional candidate attack changes the expected source digest.

Labels describe intended semantics and do not compare whole-file formatting. Test coverage separately checks source staleness, junction escapes, portable path restrictions, forged contexts, dangerous output, provider failures and CLI behavior. Fixture package scripts are deliberate tripwires and must never run. No fixture package install is permitted.

Results are synthetic, agent-authored evidence. They are not independent validation, production safety measurements, runtime migration tests or live LLM results. Workspaces are retained for explicit review. `--with-model` is unavailable until a provider is configured through the library interface; there is no bundled live provider.
