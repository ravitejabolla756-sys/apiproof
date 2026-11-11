# SEC-17 staging deployment and rollback rehearsal

## Existing release inputs

The repository already provides a release manifest script, beta readiness/preflight scripts, a protected health route, CI typecheck/test/lint/build gates, migration compatibility checks, provider review gates, and an explicit feature-flag rollback boundary. These local artifacts are inputs to a release review; they do not prove a hosted deployment or rollback.

Names that must be configured and reviewed in the target environment are documented without values: `DATABASE_URL`/`APIPROOF_DATABASE_URL`, `NEXT_PUBLIC_APP_URL` or `APIPROOF_APP_URL`, `CRON_SECRET`, `MY_OWL_APP_URL`, `MY_OWL_BETA_BASE_URL`, `MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST`, `PROVIDER_INTELLIGENCE_V1_ENABLED`, GitHub App configuration, and approved SMTP/billing/monitoring settings. Secret values must be injected through the hosting secret manager and never placed in release evidence.

## Dry-run guard

`apps/web/scripts/sec17-staging-dry-run.ts` validates a plan and performs no deployment, rollback, database, network, Vercel, secret-store, or migration operation. It requires a disposable-staging target, explicit approval and rollback owner references, evidence locations, migration-ledger evidence, passed authorization tests, approved providers, and a health path. It rejects live targets and any execution flag. A successful result means only `ready_for_owner_review`.

## Required owner approvals before a real rehearsal

- Hosting project and staging environment owner approval.
- Exact release commit, release-manifest digest, deployment permissions, and a controlled rehearsal window.
- Isolated database clone/history evidence, migration compatibility decision, backup/restore evidence, and explicit prohibition on automatic migration repair.
- Provider approvals and staging credentials for only the selected sandbox integrations.
- Named release approver, deployment operator, rollback operator, incident contact, and evidence-retention location.
- Health, authorization, queue, billing-unavailable, migration-guard, and security regression acceptance criteria.

## Rehearsal sequence

1. Freeze the reviewed commit and generate the release manifest from a clean checkout.
2. Run readiness, migration-compatibility, typecheck, lint, tests, and build gates; stop for any unresolved migration, inactive provider, or missing authorization regression.
3. Deploy only to the approved isolated staging project with non-production configuration.
4. Verify `/api/health`, authenticated authorization negatives, queue/worker health, provider-unavailable behavior, security headers, and sanitized logs.
5. Record deployment and boot times, health results, migration ledger identity, and evidence digests.
6. Exercise rollback to the last approved staging release, not by deleting data or rewriting migration history.
7. Verify health and authorization again after rollback; preserve sanitized evidence and operator approvals.

## Acceptance boundary

SEC-17 remains `BLOCKED_EXTERNAL` until a real approved staging deployment and rollback rehearsal completes. No deployment, migration, Vercel access, secret access, or hosted resource was performed in this local checkpoint. Migration IDs 024–027 remain unchanged.
