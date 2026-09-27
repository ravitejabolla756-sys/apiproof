# APIProof v1.0 — Database Backup, Safety & Retention Specification

## 1. Production Architecture Overview

APIProof production uses a high-availability PostgreSQL / Supabase cluster with workspace multi-tenancy.

### Key Database Tables

| Table | Content | Retention Policy | Cascade Rules |
| :--- | :--- | :--- | :--- |
| `workspaces` | Workspace tenancy | Indefinite | Parent for workspace domain |
| `users` | User accounts | Indefinite | Owner/member of workspaces |
| `workspace_members` | Membership & RBAC | Indefinite | `ON DELETE CASCADE` on workspace/user |
| `repositories` | Connected repos | Indefinite | Belongs to workspace |
| `scans` | Historical AST scans | **Permanent Audit Record** | `ON DELETE CASCADE` on repository |
| `findings` | Detected breaking changes | **Permanent Audit Record** | `ON DELETE CASCADE` on repository |
| `migrations` | Migration plans | **Permanent Audit Record** | `ON DELETE CASCADE` on repository |
| `pull_requests` | Draft PR proposals | **Permanent Audit Record** | `ON DELETE CASCADE` on repository |
| `github_scan_requests` | Async scan queue | Retained / Bounded | `ON DELETE CASCADE` on repository |
| `github_webhook_deliveries` | Webhook audit trail | 30 days retention | Independent table |
| `activity_events` | Workspace audit log | **Permanent Audit Record** | `ON DELETE CASCADE` on repository |

---

## 2. Backup Expectations & Recovery (RPO / RTO)

### Supabase / Managed PostgreSQL (Production)
- **Point-In-Time Recovery (PITR):** Enabled with continuous Write-Ahead Log (WAL) archiving up to 7 or 30 days.
- **Daily Automated Physical Backups:** Stored in geographically redundant S3 storage buckets.
- **RPO (Recovery Point Objective):** $< 1$ minute (via WAL archiving).
- **RTO (Recovery Time Objective):** $< 15$ minutes for automated instance restore.

### Local Development / Testing (SQLite)
- Database stored at path configured via `APIPROOF_DB_PATH`.
- Automated migrations execute via `runMigrations(db)` using atomic `_apiproof_migrations` tracking.

---

## 3. Data Safety & Non-Destructive Invariants

1. **Audit Trace Integrity:** Scans, findings, migration plans, pull requests, and activity events are immutable historical records. Deleting a session or disconnecting a GitHub App installation does **NOT** cascade or purge scan history or findings.
2. **Repository Purge:** Only explicit repository deletion within a workspace triggers cascading cleanup of dependent scan records.
3. **Delivery Deduplication:** `github_webhook_deliveries` uses `delivery_id` UNIQUE constraints to guarantee idempotency and prevent replay attacks.
