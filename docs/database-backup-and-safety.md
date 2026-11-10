# APIProof v1.0 — Database Backup, Safety & Retention Proposal

> **Verification status:** This document records proposed requirements and schema observations. It is not evidence that production uses Supabase, that backups/PITR are enabled, or that any retention period has legal or owner approval. Do not use these statements as a production readiness attestation. Confirm the actual provider configuration and complete an approved restore rehearsal before marking SEC-10 verified. Resolve retention with legal/owner and Member 2 before implementing deletion behavior (SEC-19).

## 1. Production Architecture Overview

The intended production design is a managed PostgreSQL service with workspace multi-tenancy. The current production database provider, topology, availability configuration, and effective tenant controls have not been independently verified by this workstream.

### Key Database Tables

| Table | Content | Proposed retention (unapproved) | Schema relationship observation (not a deletion authorization) |
| :--- | :--- | :--- | :--- |
| `workspaces` | Workspace tenancy | Indefinite | Parent for workspace domain |
| `users` | User accounts | Indefinite | Owner/member of workspaces |
| `workspace_members` | Membership & RBAC | Indefinite | `ON DELETE CASCADE` on workspace/user |
| `repositories` | Connected repos | Indefinite | Belongs to workspace |
| `scans` | Historical AST scans | Indefinite proposed | Repository relationship; verify deployed FK and cascade behavior |
| `findings` | Detected breaking changes | Indefinite proposed | Repository relationship; verify deployed FK and cascade behavior |
| `migrations` | Migration plans | Indefinite proposed | Repository relationship; verify deployed FK and cascade behavior |
| `pull_requests` | Draft PR proposals | Indefinite proposed | Repository relationship; verify deployed FK and cascade behavior |
| `github_scan_requests` | Async scan queue | Bounded proposed | Repository relationship; verify deployed FK and cascade behavior |
| `github_webhook_deliveries` | Webhook audit trail | 30 days proposed | Independence and deployed retention job unverified |
| `activity_events` | Workspace audit log | Indefinite proposed | Repository relationship; verify deployed FK and cascade behavior |

Retention entries above are planning values only. Legal basis, user notice, exceptions, holds, deletion scope, and approval are unresolved. No account/workspace deletion policy is authorized by this table.

### Complete Member 1 application-table inventory (schema-derived)

The following inventory reconciles the 46 unique `CREATE TABLE IF NOT EXISTS` names in `apps/web/src/lib/server/db/schema.ts` and the Member 1 TypeScript migration sources. Grouping is for data discovery only; the table names do not establish legal classification, actual production contents, cascade behavior, or deletion authorization. **Retention and deletion disposition for every group remains UNDECIDED pending legal/owner approval.**

| Data area | Tables in this branch | Retention / deletion status |
| :--- | :--- | :--- |
| Account identity and authentication | `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`, `github_oauth_accounts`, `github_login_oauth_states`, `google_oauth_accounts`, `google_oauth_states` | UNDECIDED; identify security, provider, and statutory holds before policy approval |
| Workspace tenancy and revocation audit | `workspaces`, `workspace_members`, `workspace_member_revocation_requests`, `workspace_security_audit_events` | UNDECIDED; Member 2 must approve member/workspace lifecycle contracts |
| Repository and product evidence | `repositories`, `scans`, `findings`, `finding_lifecycle_events`, `finding_resolution_verifications`, `migrations`, `pull_requests`, `github_scan_requests`, `github_webhook_deliveries`, `activity_events` | UNDECIDED; confirm source-derived data scope, audit obligations, and dependent-record treatment |
| GitHub and Slack integration records | `github_installations`, `github_installation_states`, `slack_connections`, `slack_oauth_states`, `slack_notification_deliveries`, `slack_action_tokens`, `slack_notification_dismissals`, `slack_interaction_jobs` | UNDECIDED; distinguish credentials/action tokens from delivery and audit evidence |
| Billing and entitlement records | `workspace_subscriptions`, `workspace_usage`, `billing_webhook_events` | UNDECIDED; owner/legal must approve statutory and provider-required retention |
| Provider change intelligence and rescans | `provider_change_sources`, `provider_changelog_entries`, `provider_rule_candidates`, `provider_rule_reviews`, `provider_rescan_jobs`, `repository_provider_usage`, `repository_rescan_jobs`, `slack_provider_change_deliveries` | UNDECIDED; define workspace attribution, provider provenance, and audit retention |
| Operational and migration-control data | `_apiproof_migrations`, `rate_limits`, `migration_verification_jobs`, `migration_verification_workers`, `worker_run_heartbeats` | UNDECIDED; define operational/debug retention and migration-history preservation |

This inventory covers **46 distinct Member 1 schema table names**. Member 2's separate `workspace_invitations` table is not part of this branch's current schema inventory and must be added during approved cross-member integration. Backups, provider snapshots, external log sinks, and GitHub/Slack/provider-held copies are separate retention surfaces and are not represented by these application-table names. Do not delete or anonymize any listed records until the policy and Member 2 contracts are approved.

---

## 2. Backup Expectations & Recovery (RPO / RTO)

### Managed PostgreSQL (target; production status unverified)
- **PITR/WAL retention:** Proposed requirement; provider, enabled state, and retention window require read-only configuration evidence.
- **Automated backups and storage geography:** Proposed requirement; schedule, encryption, access controls, and storage location require provider evidence.
- **RPO/RTO:** Earlier values of under one minute and under 15 minutes are unvalidated targets, not measured or approved service objectives. Define them with the owner and verify them in a timed restore rehearsal.

### Local Development / Testing (SQLite)
- Database stored at path configured via `APIPROOF_DB_PATH`.
- Automated migrations execute via `runMigrations(db)` using atomic `_apiproof_migrations` tracking.
- No SQLite backup/restore automation or restore verification is established by these statements.

---

## 3. Data Safety & Non-Destructive Invariants

1. **Audit Trace Integrity:** Application behavior should preserve historical records when deleting a session or disconnecting a GitHub App installation. This invariant does not override legal deletion requirements; actual database cascade behavior must be checked against the deployed schema.
2. **Repository Purge:** Only explicit repository deletion within a workspace triggers cascading cleanup of dependent scan records.
3. **Delivery Deduplication:** `github_webhook_deliveries` uses `delivery_id` UNIQUE constraints to guarantee idempotency and prevent replay attacks.
