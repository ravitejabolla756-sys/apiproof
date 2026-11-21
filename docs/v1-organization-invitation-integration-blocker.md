# Organization and Invitation Integration Blocker

## Finding

Member 2's organization service requires these tables:

- `workspace_invitations`
- `workspace_audit_events`

Member 2 creates them in `organization-migration.ts` as migration `024` named `workspace_invitations_and_audit_events`.

The integration branch already reserves the Member 1 migration registry, where `024` is email verification and `027` is durable workspace-member revocation. Registering Member 2's migration would create an ID/name collision and the migration identity guard would correctly reject the history.

The integration branch currently contains none of Member 2's organization service, invitation routes, audit routes, or organization schema. Activating those routes now would therefore either fail at runtime due to missing tables or require an unsafe duplicate/implicit schema path.

## Decision

Do not activate Member 2 organization or invitation routes in this slice. Do not copy or register the conflicting migration. Do not create a competing member-removal transaction.

## Required next integration work

1. Obtain approved isolated migration-ledger/schema evidence.
2. Approve a forward-only compatibility identity for Member 2's organization schema.
3. Bring the organization schema through the approved compatibility mechanism, including PostgreSQL RLS and grants.
4. Integrate the reusable service without its old `removeOrganizationMember` mutation path.
5. Adapt `DELETE /api/workspace/members` to call `revokeWorkspaceMember`.
6. Add transactional invitation invalidation and the `member.removed` audit projection in the same transaction.
7. Enable the invitation routes only after disposable schema tests, authorization tests, and migration guard tests pass.

## Security gap recorded

Member 2's current removal service executes `DELETE FROM sessions WHERE user_id = ?`. This global deletion is rejected for integration. Workspace removal must preserve personal sessions and unrelated workspace access.

## Evidence boundary

No Member 2 organization schema was applied to a database. No staging or production database was accessed. Synthetic contract tests do not establish legacy database compatibility, PostgreSQL concurrency, RLS, or grants.
