# Security Review Checkpoint

Updated: 2026-10-09

## Verified locally

- `/api/internal/scan-worker` requires `Authorization: Bearer <CRON_SECRET>`.
- Preview isolation accepts only the explicit staging database configuration and rejects generic fallback configuration in isolation mode.
- The worker’s GitHub repository transport permits GET-only reads.
- The worker does not expose a repository write transport for comments, checks, pull requests, or contents.
- Installation-token minting is a GitHub App authentication operation, not a repository content write.
- Productization persistence uses bounded projections and excludes raw source, credentials, and secret-like values.
- Privacy and secret-redaction worker tests pass.
- Repository and scan API routes authenticate and authorize repository access.
- Compatibility decisions come from the reviewed official registry; synthetic fixtures are not compiled into production.

## Not yet verified remotely

- Preview’s effective feature flags and write flag.
- Preview’s effective staging database secret and absence of generic database fallback.
- Active staging installation and repository authorization rows.
- Presence of a pending scan request for the controlled fixture.
- Actual deployed commit parity with local `13617170c4528bcde0827b50b51499963000418e`.
- Exact worker-level enforcement of the single approved staging repository. The current worker path passes `allowAnyRepository: true` when constructing the GitHub source provider; this must be verified or hardened before a live scan.

## Security blockers

Do not execute a scan until the remote checks above are completed read-only and the worker-level staging repository boundary is proven. Do not expose a secret-bearing health or database diagnostic. Do not enable GitHub writes. Do not use a production database connection to create or inspect the queue item.
