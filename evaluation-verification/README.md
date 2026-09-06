# Verification corpus

`manifest.json` is the execution allowlist. Only its registered fixture IDs may be passed to the verification orchestrator; commands are fixed arrays and lifecycle scripts are disabled. `labels/cases.json` contains 15 FakeSandbox cases covering pass, stage failures, timeout, output limits, environment/filesystem/network policy metadata, command injection and unauthorized fixtures.

Run `pnpm apiproof evaluate-verification --json`. Normal evaluation uses `FakeSandbox` and executes no fixture code. Docker is opt-in and must be reported separately; this host has no running Docker daemon.
