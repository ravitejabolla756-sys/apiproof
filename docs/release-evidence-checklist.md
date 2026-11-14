# MY OWL V1 Release Evidence Checklist

Status: preparation only. No live, staging, production, or existing-database operation is authorized by this document.

## PostgreSQL RLS, grants, and tenant isolation

Required evidence:

- Approved disposable PostgreSQL endpoint, engine/version, sanitized migration ledger, and schema provenance.
- Separate application, migrator, read-only, and administrative role identifiers.
- `pg_class.relrowsecurity` and `relforcerowsecurity` for every tenant-owned table.
- `pg_policies` definitions with roles, `USING`, and `WITH CHECK` expressions.
- Effective grants, role memberships, inheritance, `rolbypassrls`, and schema privileges.
- A documented transaction-scoped tenant context mechanism used by the application, workers, and administrative paths.
- Cross-tenant SELECT/INSERT/UPDATE/DELETE/function-call negatives, including after membership revocation and invitation invalidation.
- Pool reuse tests proving tenant context cannot leak between connections or transactions.

Safe procedure:

1. Restore an owner-approved disposable database copy into an isolated PostgreSQL destination.
2. Run `docs/migration-history-evidence.postgres.sql` and `docs/sec-02-postgres-grants.sql` with approved read-only roles.
3. Compare the sanitized results with the integration schema and migration identities.
4. Only after the owner approves the tenant-context contract, add a new forward-only RLS/grants migration with a unique identity.
5. Run role-isolation and concurrency tests against the disposable destination, then obtain review approval.

Current result: **BLOCKED**. Docker PostgreSQL is unavailable, no approved endpoint was supplied, and the source does not yet establish the policy/context/role contract required for a safe RLS migration.

## Migration reconciliation 024–027

Required evidence:

- Complete `_apiproof_migrations` rows with IDs, names, and timestamps from fresh, Member 1 legacy, Member 2 legacy, and mixed-history databases.
- Schema fingerprints for every object introduced by the conflicting identities.
- Evidence of partial application, manual changes, missing tables, indexes, constraints, and applied provenance.

Safe procedure:

1. Collect ledger and schema metadata only from approved isolated copies.
2. Match historical identity by ID, name, and schema fingerprint.
3. Accept only exact known identities; fail closed on ambiguity or conflicts.
4. Preserve applied IDs and append new unique IDs only after the highest verified history.
5. Test fresh and legacy upgrades before any existing-database operation.

Current result: **BLOCKED**. Synthetic migration tests pass, but authoritative database-history evidence is unavailable.

## Hosted CI

Required evidence:

- A hosted run of install, dependency audit, lint, typecheck, provider validation, Vitest, build, and release-manifest checks.
- Branch-protection required checks and fork/PR secret-boundary review.

Safe procedure: push only after owner approval, inspect the hosted run, and do not expose production secrets to untrusted pull requests.

Current result: **LOCAL_READY / HOSTED_PENDING**. CI contract tests and local equivalents pass.

## Backup, restore, staging, and rollback

Required evidence:

- Owner-approved backup source and disposable restore destination.
- Backup manifest, encryption/key ownership, migration ledger, grants, tenant-isolation checks, elapsed restore time, and observed data loss.
- Staging deployment approval, health path, rollback owner, rollback window, and retained evidence location.

Safe procedure: use the existing dry-run scripts first; execute only against explicitly approved disposable resources. Never use production or staging URLs by default.

Current result: **BLOCKED**. Dry-run scripts take no actions and correctly report missing approvals.

## Provider and legal gates

Required approvals:

- GitHub App permissions, webhook sandbox, replay/deduplication evidence, and repository authorization.
- Billing provider, merchant/tax/currency policy, sandbox credentials, webhook contract, and lifecycle policy.
- Email provider, verified sender/domain, templates, bounce handling, retry policy, and retention.
- AI provider, structured-output contract, cost ceiling, data-handling policy, timeout/retry policy, and human-review boundary.
- Monitoring provider, redaction, retention, alert thresholds, escalation owners, and incident evidence location.
- Legal retention, export, deletion, and final-owner/account policy approval.

Current result: **BLOCKED_EXTERNAL**. Local adapters and fixtures do not constitute provider, legal, or production acceptance.

## Final security acceptance

Required evidence:

- All 53 task statuses reconciled to executable evidence.
- Migration, PostgreSQL, authorization, browser/accessibility, provider, backup/restore, staging/rollback, monitoring, and legal gates passed.
- Named owner signoffs and a reproducible release-candidate commit.

Current result: **NO-GO**. `security:release:audit` reports 10 accepted tasks and 43 unresolved tasks; production-verified count is zero.
