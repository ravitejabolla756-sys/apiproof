# SEC-19 account deletion and retention decision package

## Current state

The combined application intentionally does not expose a `DELETE /api/account` operation. The account settings page keeps the deletion action disabled with `DELETION_CONTRACT_PENDING`. This package adds only a pure dry-run planner; it performs no database, provider, queue, export, or destructive operation.

## Data inventory and dependency graph

| Area | Current objects or destination | Scope | Required disposition decision |
|---|---|---|---|
| Identity | `users`, `sessions`, `password_reset_tokens` | User | Delete, anonymize, or retain window |
| Organization | `workspaces`, `workspace_members`, `activity_events` | Workspace/owner | Transfer or close sole-owner workspaces first |
| Product data | `repositories`, `scans`, `findings`, `migrations`, `pull_requests` | Workspace | Delete, export-then-delete, or legal hold |
| GitHub | `github_installations`, installation state, provider-side installation | Workspace/provider | Revoke connection and define provider retention |
| Billing | `workspace_subscriptions`, `billing_webhook_events`, provider customer/invoice records | Workspace/provider | Legal/tax retention and provider deletion contract |
| Security | audit/security events and queued job evidence | Workspace/owner review | Retain minimum evidence without personal-data leakage |
| Recovery | backups, exports, PITR and snapshots | System/provider | Retention window, expiry and restore implications |

The safe dependency direction is: authenticate and reauthenticate the subject → validate CSRF and idempotency → resolve all workspace ownership → obtain approved retention policy → create a reviewable plan → perform provider revocations and database changes in an approved job. No step may infer authority from client workspace or role claims.

## Required server contract before activation

- The actor must equal the subject, have a valid current session, pass recent reauthentication, and pass the existing CSRF protection.
- The request must use a server-generated or validated idempotency key. Replays return the same recorded outcome; key reuse for a different subject or policy version is rejected.
- Workspace membership and owner counts must be read from the server inside the transaction. A sole owner requires an approved transfer or workspace-closure decision.
- A durable job must revalidate authorization and policy version before every destructive step. It must never delete unrelated workspace data or all sessions by `user_id` without the approved scope.
- Retention, legal hold, export, billing, GitHub, audit and backup actions must be explicit. Unknown policy values fail closed.
- The current UI remains unavailable until the owner approves the policy and an isolated PostgreSQL/backup rehearsal succeeds.

## Owner and external decisions

Legal/product owners must approve retention windows, legal holds, audit and invoice retention, anonymization rules, export format, backup/PITR expiry, provider-side deletion, notification templates, final-owner transfer/closure, support escalation, and the policy version. Infrastructure owners must provide isolated PostgreSQL schema/ledger evidence and an authorized disposable restore destination. No production credentials or customer data are needed for the dry-run tests.

## Evidence boundary

The planner tests prove deterministic local policy validation and fail-closed behavior only. They do not prove PostgreSQL transaction isolation, RLS, provider deletion, backup erasure, hosted OAuth, or legal compliance. Those remain blocked until the approvals and isolated rehearsals are available.
