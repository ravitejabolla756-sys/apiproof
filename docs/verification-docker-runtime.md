# Verification Docker selection

The trusted worker environment file can configure existing Docker settings:

- `DOCKER_PATH`: Docker CLI executable path (not a shell command). Defaults to `docker`.
- `DOCKER_CONTEXT`: named context, passed as an explicit global CLI option to preflight, provisioning, verification and cleanup. For Windows Docker Desktop this is normally `desktop-linux`.
- `DOCKER_HOST`: endpoint when no named context is selected. Docker context selection takes precedence.
- `DOCKER_CONFIG`, `DOCKER_CERT_PATH`, `DOCKER_TLS_VERIFY`: standard Docker configuration and TLS discovery.

These settings belong to the worker host, not the repository being verified. No new credentials or configuration names are introduced. Existing unconfigured Linux workers retain default Docker discovery. The child environment remains allowlisted; application secrets are not forwarded.

Preflight checks for a Linux engine, then inspects exactly `node:22.14.0-alpine3.21` using `--format {{.Id}}`. A successful exit and a valid SHA-256 image ID are both required. Full inspection metadata is deliberately not requested: it can exceed the 4 KiB bounded output buffer and previously produce a false unavailable result. Inspection failures retain their underlying error as `cause` without publishing raw daemon output in heartbeat messages.

This does not pull images, change the pinned tag, enable network access for verification, or bypass readiness. Existing `--pull=never`, read-only mounts, capability restrictions, resource limits and evidence gates remain intact. Dependency acquisition retains its existing separate restricted networked helper.
