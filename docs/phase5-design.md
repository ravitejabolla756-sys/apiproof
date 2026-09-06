# Phase 5 isolated execution verification

Phase 5 adds execution verification after a statically validated Phase 4 candidate. Generation remains independent: generators never receive a sandbox or command runner.

Only fixtures listed in `evaluation-verification/manifest.json` may execute. Commands are fixed argument arrays from APIProof-owned metadata. Package scripts are never invoked; install uses `--offline --ignore-scripts`. The default network policy is `NETWORK_DISABLED`; only `PATH`, `CI=true` and `NODE_ENV=test` are passed. Docker uses network none, a read-only root, dropped capabilities, no-new-privileges, PID/memory/CPU limits, a noexec temporary filesystem and only the disposable workspace mount. It never mounts APIProof, user profiles, credential stores, `.git` or the Docker socket.

`ExecutionSandbox` provides deterministic `FakeSandbox` tests and an opt-in `DockerSandbox`. Each stage records exit status, bounded stdout/stderr, truncation flags and digests. Statuses distinguish install, build, typecheck, test, timeout, policy and sandbox failures. A pass means only configured fixture checks passed and always requires human review. Docker was unavailable on this Windows host, so no Docker result is claimed.

The authored verification corpus contains 15 cases: passing fixtures, each failing stage, timeout, output flood, probe metadata, command-injection policy rejection, unregistered fixture rejection and malformed candidate rejection. Normal evaluation uses FakeSandbox and does not execute fixture code.
