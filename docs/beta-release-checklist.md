# Limited Beta Release Checklist

## Safety gates

- [x] Preview staging isolation code exists and is fail-closed.
- [x] Worker feature flag is strict-literal `true`.
- [x] GitHub worker transport is read-only for repository access.
- [x] Live GitHub writes are separately gated.
- [ ] Deployed Preview values independently verified.
- [ ] Staging schema and active repository/installation rows independently verified.
- [ ] One approved staging scan executed and persisted.
- [ ] No production target or database fallback observed during that scan.

## Product evidence

- [x] Reviewed registry is official-source gated.
- [x] Unknown and dynamic usage remains `NEEDS_REVIEW`.
- [x] Exact OpenAI `responses.create` worker fixture produces an affected finding locally.
- [x] Proof and bounded persistence contracts pass locally.
- [x] Scan History API/UI field contract is covered locally (`files_analyzed`).
- [ ] Real repository proof is available through authenticated APIs.
- [ ] Scan history file count has been verified on the deployed UI.

## Release gates

- [x] Full local Vitest suite passes.
- [x] Package and web typechecks pass.
- [x] Lint passes.
- [x] Clean production-style build passes; local elevated run generated the complete web route set with non-fatal warnings only.
- [ ] Security review has no unresolved remote-configuration blocker.
- [ ] Human approval exists for the one live staging scan.

Current recommendation: **do not launch the beta yet**. Complete the unchecked remote evidence and build gate first.
