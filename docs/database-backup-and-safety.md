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
