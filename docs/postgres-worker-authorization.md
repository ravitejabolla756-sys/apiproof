# PostgreSQL worker authorization boundary

The worker HMAC protects the HTTP entrypoint, but it is not a database identity
and must not be copied into tenant GUCs or SQL parameters. PostgreSQL worker
execution therefore requires the zero-argument function
`apiproof_security.has_trusted_worker_identity()`.

The function is deliberately not created by the candidate tenant-security SQL.
An approved database owner must provision it so the result is bound to a
separately authenticated, least-privilege worker database role or equivalent
connection identity. It must:

- accept no user, workspace, session, token, or tenant identifiers;
- return false for the ordinary application role;
- avoid `BYPASSRLS`, role inheritance, and table-owner privileges;
- use a safe `search_path` and restricted `EXECUTE` grants; and
- fail closed when the worker role or connection identity is not approved.

Until that contract exists, `runVerificationWorker()` rejects PostgreSQL startup
with `WORKER_DATABASE_AUTH_UNAVAILABLE` or `WORKER_DATABASE_AUTH_DENIED`, while
disposable SQLite fixtures remain unchanged.

The hosted fixture creates synthetic `apiproof_ci_app` and
`apiproof_ci_worker` roles and validates the role-bound bridge. It is evidence
for this isolated boundary only; it does not prove production role provisioning,
all worker query paths, migration-history compatibility, or hosted operational
readiness.
