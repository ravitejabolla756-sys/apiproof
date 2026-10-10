# Multi-provider staging validation

This validation is local and read-only. It builds one in-memory repository snapshot from the reviewed production registry and sends that snapshot through the real `runProductizationScan()` path. It does not write a checkout, contact GitHub, enqueue a scan, invoke a worker, or modify cloud state.

Run it with:

```text
pnpm providers:validate:multi
```

The generated snapshot contains one `package.json` with the reviewed provider dependencies and one TypeScript source file per reviewed change under `src/provider-validation/`. The files are generated from the same analyzer-recognized source patterns used by the provider validation factory. The real scanner produces provider discovery, normalized IR, compatibility results, Compatibility Proofs, bounded persistence projections, and findings.

Expected local result:

- 15 discovered providers
- 19 `AFFECTED` findings for the provable positive rules
- 1 Anthropic parameter rule classified `NEEDS_REVIEW`
- 20 Compatibility Proof records
- no duplicate findings or cross-provider matches

The Anthropic parameter fixture deliberately uses an unresolved parameter expression. Anthropic documents the non-default-value behavior but does not publish numeric defaults in the deprecation source, so this fixture must remain `NEEDS_REVIEW`.

## One future staging execution

After explicit operator approval, place the generated source tree in the already-approved staging repository `ravitejabolla756-sys/my-owl-staging-affected-openai` as one controlled commit on `main`. Do not create another project, worker, or GitHub App. Read-only verify the resulting commit and then enqueue one request for repository ID `1408947921` using that exact commit SHA. Invoke the existing protected worker once with `{"batchSize":1,"timeoutMs":50000}` and verify the persisted findings and Compatibility Proof API response. The existing OpenAI scan remains untouched.

If the remote commit is not approved, the multi-provider live execution is blocked; this local fixture remains the reproducible preflight.
