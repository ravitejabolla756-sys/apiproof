# APIProof Phase 5 completion report

Release **0.5.0** added isolated execution verification for registered APIProof-owned fixtures. Phase 6 behavioral contract verification is documented separately in [phase6-results.md](phase6-results.md).

The existing Phase 4 suite remains passing; the complete suite is **247 tests**. Verification schemas preserve `requiresHumanReview: true`; a pass means configured checks passed in the selected sandbox and does not mean production safety.

The allowlist contains four entries in `evaluation-verification/manifest.json`; three are executable fixture identities and one deliberately refuses execution. Commands are APIProof-controlled arrays. Lifecycle scripts are disabled, network is disabled, and only an explicit environment allowlist is supplied.

The verification corpus contains 15 labeled cases. FakeSandbox results are deterministic: 15/15 correct final statuses, 15/15 correct failing stages, timeout 1/1, output bounds 15/15, environment isolation 15/15, filesystem isolation 15/15, network policy 15/15, command-injection policy 1/1, unauthorized fixture rejection 1/1, sandbox escapes 0 and host-secret leakage 0. No fixture process was executed during FakeSandbox evaluation.

Docker was checked on this Windows host and is unavailable. DockerSandbox evaluation is **NOT EXECUTED**; no Docker result is fabricated. The CLI reports FakeSandbox results and this Docker boundary explicitly.

`verify-patch <run-id>` reads only the APIProof-created UUID run artifact and checks that its fixture is registered before invoking the FakeSandbox. Arbitrary, missing or unregistered run IDs are refused. Remaining limitations include no OS guarantee against hostile concurrent local replacement and no project-level behavior/API-contract verification. Phase 6 may be proposed separately; it has not started automatically.
