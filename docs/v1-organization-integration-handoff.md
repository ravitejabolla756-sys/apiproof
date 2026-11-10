# MY OWL V1 Organization Integration Handoff

## Current source behavior

Member 1 exports `buildMemberRevocationPlan(request, context)` and `revokeWorkspaceMember(actorUserId, request)`. The implementation is workspace-scoped, checks current membership and owner count, supports idempotency, writes `workspace.member_revocation.v1`, preserves personal sessions and unrelated memberships, and requires queued jobs to recheck membership.

Member 2 exports `removeOrganizationMember(userId, workspaceId, targetUserId)`, `acceptWorkspaceInvitation`, `revokeWorkspaceInvitation`, and organization audit helpers. Its DELETE route accepts `{ workspaceId, userId }` and returns `{ success: true }`.

## Required integration changes

1. Replace Member 2's removal implementation with the Member 1 revocation boundary.
2. Remove the global `DELETE FROM sessions WHERE user_id = ?` behavior. It incorrectly revokes unrelated workspace and personal sessions.
3. Load the target email from the database and invalidate unaccepted invitations in the same transaction as membership removal.
4. Preserve Member 2's `{ success: true }` response and optionally add verified revocation metadata.
5. Map final-owner, capability, access, self-revocation, and idempotency conflicts to the approved error codes.
6. Project the authoritative security event to Member 2's `member.removed` audit action without storing tokens or credentials.
7. Keep invitation acceptance conditional on both `accepted_at IS NULL` and `revoked_at IS NULL`.
8. Revalidate membership inside privileged queued workers.

## Contract status

The Member 1 revocation service, workspace policy, and durable revocation migration definition are now integrated into this worktree. The typed API contract remains a proposal until Member 2 approves it. Invitation invalidation, queued-job revalidation, stale-context route coverage, and PostgreSQL concurrency remain pending because Member 2's organization service and migration registry are not integrated.

The integrated migration definition still uses Member 1's source ID `027`. It must not be combined with Member 2's conflicting `027` until the approved migration-history decision is complete.

Phase 8B is currently blocked from route activation because Member 2's organization tables are supplied by conflicting migration `024`. The exact blocker and safe sequence are recorded in `docs/v1-organization-invitation-integration-blocker.md`.

## Safe integration sequence

1. Approve the shared request, response, error, event and audit contracts.
2. Integrate Member 1 revocation service and migration dependencies in an isolated merge commit.
3. Adapt Member 2 organization routes/services to call the revocation boundary.
4. Add invitation invalidation and audit projection inside the same transaction.
5. Run the organization, authorization, session, invitation-race, worker, typecheck, lint and browser contract matrix.

No migration IDs, databases, source branches, production resources, payment providers or external services were changed by this handoff.
