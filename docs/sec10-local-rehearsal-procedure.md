# SEC-10 Non-Destructive Backup/Restore Rehearsal

This procedure is preparation only. It must run against a disposable local or
approved isolated staging database, never production, and must not expose
credentials in logs or evidence.

## Preconditions

- An approved database owner identifies the source and destination fixtures.
- The source is a disposable copy with synthetic records only.
- Backup/PITR provider, retention, RPO and RTO targets are approved.
- The operator has a temporary least-privilege read/restore role.
- The application is stopped or isolated from the rehearsal database.
- Secrets are injected through the approved environment, never recorded.

## Rehearsal

1. Record a sanitized source identifier, schema/migration ledger digest and start time.
2. Create the provider-native backup or logical export using the approved non-production method.
3. Restore into a new isolated database name; never overwrite the source.
4. Verify the migration ledger, table inventory, row-count checksums and the PostgreSQL query pack.
5. Run authentication, organization authorization, billing projection and worker-authorization checks against the restored copy.
6. Record elapsed restore time, object differences, failed checks and the sanitized provider operation ID.
7. Destroy the disposable destination only under the approved cleanup policy.

## Acceptance criteria

- Source remains unchanged.
- Restore completes within the approved RTO.
- Data loss is within the approved RPO.
- `_apiproof_migrations` identities match the source and no migration is silently skipped because of an ID/name mismatch.
- Tenant-sensitive tables, RLS state, policies and grants match the approved baseline.
- No credential, token, connection string, raw provider error or customer data appears in logs or evidence.
- A failed rehearsal remains a failed gate; assertions are not weakened.

SEC-10 remains blocked until an approved operator completes this rehearsal and the owner accepts the evidence.
