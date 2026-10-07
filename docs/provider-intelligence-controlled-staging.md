# Provider Intelligence V1 — Controlled Staging Runbook

This runbook is prepared for staging only. It has not been executed against production, a live GitHub write flow, or a production database.

## Preconditions

- Build and deployable package typechecks are green.
- The server-side `PROVIDER_INTELLIGENCE_V1_ENABLED` flag is unset or `false` before rollout.
- Use a staging workspace and staging GitHub App installation.
- Use repository commits whose SHAs are verified by the source-control provider.
- Do not place credential values in fixture files. Environment-variable names may be present; values must remain outside repository content.

## Fixtures

| Fixture | Contents | Expected result |
| --- | --- | --- |
| affected-ts | OpenAI `gpt-4.5-preview` call | AFFECTED finding and repository-bound proof |
| unaffected-ts | OpenAI `gpt-4.1` call | NOT_AFFECTED compatibility result |
| needs-review-ts | Dynamic model/resource expression | NEEDS_REVIEW, never AFFECTED |
| five-provider | OpenAI, Anthropic, GitHub, Twilio, and Supabase evidence in separate files | Deterministic provider ordering, isolated reviewed changes, no duplicate change IDs |

The fixtures must be fetched through the real worker source-control boundary. Calling `runProductizationScan()` alone is not a staging proof.

## Controlled procedure

1. Enable the flag only in the staging server environment: `PROVIDER_INTELLIGENCE_V1_ENABLED=true`.
2. Submit one scan request per fixture at a verified commit SHA.
3. Run the internal scan worker once with a bounded batch and timeout.
4. Verify the request reaches `completed` or a safe terminal `failed`/`skipped` state; no request may remain `processing` after its lease expires.
5. Verify the persisted scan, findings, Inventory projection, Compatibility Map projection, and repository-bound Proof projection use the same scan ID and baseline SHA.
6. Verify raw source snippets are empty for provider-intelligence findings and that credential values, authorization headers, and source markers are absent from persistence, HTTP responses, and logs.
7. Verify the five-provider fixture has no cross-provider claims, duplicate change IDs, or synthetic records.
8. Disable the flag and restart the staging runtime. Re-run a scan and verify the legacy path is selected without a database rollback.

## Rollback boundary

Only the exact literal value `true` enables the new path. Unset, `false`, `TRUE`, `1`, and `yes` select the legacy path. Rollback is therefore a server-side flag change plus a staging runtime restart; it does not require a database rollback.

## Evidence to capture

Record, per fixture: repository ID, scan ID, verified baseline SHA, fetch duration, analysis/Productization duration, compatibility duration, persistence duration, proof retrieval duration, total worker duration, final job state, finding count, and safe error code if failed. These local staging measurements are not production performance claims.

## Stop conditions

Stop the staging exercise if a source fetch SHA differs, a worker request remains stuck, a proof is returned for a different repository or scan, a raw source body or secret value is observed, an unknown registry record is evaluated, or an exception is exposed outside a fixed safe error code.
