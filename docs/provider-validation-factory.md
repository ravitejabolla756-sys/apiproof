# Multi-provider validation factory

`pnpm providers:validate:all` is a local, read-only validation harness for the reviewed compatibility registry. It is intentionally separate from the production registry source and from live scan-worker execution.

The factory enumerates the compiled official reviewed registry, sorted by `changeId`, and runs three deterministic normalized-IR cases per rule:

- `affected`: every authoritative dimension is an exact match and static evidence is complete.
- `not_affected`: the authoritative target is replaced with the reviewed replacement when available, otherwise a distinct safe value.
- `needs_review`: authoritative evidence is unresolved and static confidence is below the evaluator threshold.

Those cases use `evaluateRegisteredNormalizedCompatibility`, so they exercise the actual production registry and provider-neutral evaluator. Each rule also gets a source snapshot fixture through `runProductizationScan`. That path runs provider discovery, TypeScript analysis, normalized IR conversion, compatibility evaluation, compatibility proof generation, the bounded customer-visible projection, and the finding projection.

The command prints JSON by default. Pass `--markdown` for the human-readable matrix. Productization coverage is reported separately from engine coverage: a `PARTIAL` row means the existing analyzer did not prove that semantic shape from the generated source fixture. It is not converted into a synthetic `AFFECTED` result. This makes unsupported analyzer shapes visible for later, evidence-backed adapter work.

The factory also checks that a positive usage under an unrelated provider produces no affected result and that duplicate usage identities are deduplicated by the production evaluator. It does not connect to PostgreSQL, call GitHub, invoke workers, or modify cloud state.

The bounded projection and finding projection are validated as local pure functions. Raw source text is not included in their report contract and secret-like values are not emitted.
