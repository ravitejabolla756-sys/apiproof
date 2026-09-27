# APIProof v1.0 Production Documentation

This document serves as the authoritative production manual and architectural reference for APIProof v1.0.

---

## 1. APIProof System Overview

APIProof is a multi-tenant, SaaS-enabled system designed to automate impact analysis, migration planning, and draft Pull Request generation for breaking third-party API changes (e.g., Stripe, Twilio). 

### Key Architectural Characteristics
- **Multi-Tenant SaaS Foundation**: Enforces workspace boundary isolation across users, repositories, scans, findings, migrations, and audit logs.
- **Deterministic AST Engine**: Inspects TypeScript code using TypeScript compiler AST parsers to match breaking vendor API changes with zero runtime execution of customer code.
- **Draft-Only Safety Invariant**: Generates pull requests exclusively as GitHub **Draft PRs** on isolated branches (`apiproof/migration-...`). APIProof NEVER merges PRs, NEVER writes to default branches, and NEVER executes customer code.
- **Asynchronous Execution Architecture**: Decouples webhook reception from AST processing via a durable PostgreSQL job queue with `SELECT ... FOR UPDATE SKIP LOCKED` atomic claiming.

---

## 2. GitHub App Installation

APIProof connects to GitHub organizations and personal accounts using a dedicated GitHub App.

### Installation Flow
1. User clicks **Connect GitHub** in the APIProof Dashboard.
2. The user is redirected to GitHub's App installation URL (`https://github.com/apps/<app-name>/installations/new`).
3. The user selects target repositories (or "All repositories") and completes installation.
4. GitHub redirects back to `/api/github/callback?installation_id=...&setup_action=install`.
5. APIProof links the `installation_id` to the user's active workspace and stores installation metadata in `github_installations`.

### Required Permissions
- **Repository Contents**: Read & Write (Write required strictly to push candidate migration branches and open draft PRs).
- **Metadata**: Read-only.
- **Pull Requests**: Read & Write (to open draft PRs).
- **Webhooks**: Subscribed to `push`, `installation`, and `installation_repositories`.

---

## 3. Repository Connection

Workspace members can view and connect repositories from their active GitHub installation.

### Sync & Connection Mechanics
- `/api/github/repositories` lists available repositories from the workspace's GitHub App installation.
- Connecting a repository creates a record in `repositories` linked to the `workspace_id`.
- Repositories maintain live health and status flags:
  - `connected`: Active and monitored.
  - `disconnected`: Manually disconnected or removed from installation scope.
  - `suspended`: GitHub installation is suspended.
  - `deleted`: GitHub installation or repository was removed on GitHub.

---

## 4. Scan Lifecycle

Scans analyze code at an exact git commit SHA for breaking third-party API pattern matches.

### Life Cycle Stages
1. **Trigger**: Triggered via GitHub `push` webhook or manual "Run AST Scan" API call.
2. **Pending**: APIProof creates a durable `github_scan_requests` record and a `scans` row with `status = 'pending'`.
3. **Claiming**: The scan worker atomically claims pending scan jobs (`status = 'processing'`) using transaction locks.
4. **Execution**: The scan worker fetches the commit repository tree via GitHub App installation tokens, runs the AST analyzer in memory, and matches symbols against the provider rule registries (Stripe & Twilio).
5. **Completion**: Findings are written to `findings`, scan summary updated (`status = 'completed'`), and an activity log event is recorded.

---

## 5. Findings Experience

Findings represent verified matches between vendor breaking change definitions and AST call sites in repository source files.

### Attributes
- `id`: Unique finding identifier.
- `rule_id` / `change_id`: Standardized provider rule ID (e.g., `stripe-2024-12-18-charge-dispute`).
- `severity`: Severity level (`critical`, `high`, `medium`, `low`) provided by official rule registries.
- `file_path` & `line_number`: Precise source location.
- `symbol`: AST method or type symbol matched (e.g., `stripe.disputes.retrieve`).
- `description`: Explanation of the breaking API change.
- `evidence`: Matched AST code snippet context.
- `status`: Finding state (`open`, `resolved`, `ignored`).

---

## 6. Migration Experience

APIProof provides deterministic migration planning and candidate patch generation.

### Migration Flow
1. User selects a finding and clicks **Plan Migration**.
2. The migration planner generates a unified diff patch (`.patch`) transforming outdated API usages to the modern provider format.
3. The proposed patch is verified against synthetic test AST fixtures.
4. If verified, the user can click **Create Draft PR**.
5. APIProof creates branch `apiproof/migration-[finding-id]`, commits the patch, and opens a Draft Pull Request on GitHub.

---

## 7. Draft PR Safety Invariants

APIProof adheres to strict, immutable safety controls:

1. **Draft PR Only**: Every pull request is created with `draft: true`.
2. **Isolated Branching**: Patches are pushed strictly to `apiproof/migration-*` branches.
3. **Exact Baseline SHA**: Patches are applied against the exact commit SHA scanned.
4. **Canonical Patch Digest**: SHA-256 digests verify patch integrity before PR creation.
5. **No Auto-Merge**: APIProof NEVER merges PRs or modifies default branches under any circumstances.
6. **No Remote Code Execution**: Customer code is never executed, built, or evaluated in a sandbox.

---

## 8. Webhook Setup

GitHub webhooks keep APIProof in sync with installation events and repo pushes.

### Configuration
- **Payload URL**: `https://your-domain.com/api/webhooks/github`
- **Content Type**: `application/json`
- **Secret**: Set via `GITHUB_WEBHOOK_SECRET` environment variable.

### Security & Integrity
- All incoming webhooks require valid `X-Hub-Signature-256` HMAC validation.
- Delivery IDs (`X-GitHub-Delivery`) are recorded for replay protection and idempotency.

---

## 9. Worker Setup

The asynchronous scan worker executes pending scan jobs reliably.

### Worker Operation
- Endpoint: `POST /api/internal/scan-worker`
- Authorization: Requires `Authorization: Bearer <WORKER_SECRET>` header.
- Claiming Engine:
  - **PostgreSQL**: `SELECT ... FOR UPDATE SKIP LOCKED` ensures zero race conditions across horizontal worker nodes.
  - **SQLite** (dev/local): Transactional status updates.
- Stale Job Recovery: Jobs stuck in `processing` longer than 15 minutes are automatically reset to `pending` with incremented retry count. Max retries: 3.

---

## 10. Local Development

### Prerequisites
- Node.js `^22.14.0`
- pnpm `^10.0.0`

### Setup Steps
```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Run database migrations (or auto-initialize SQLite)
pnpm build

# 4. Start local development server
pnpm dev

# 5. Run full test suite
pnpm test
pnpm typecheck
pnpm lint
```

---

## 11. Environment Variables

| Variable | Description | Required | Default |
| font-mono | --- | --- | --- |
| `PORT` | Web server listening port | No | `3000` |
| `DATABASE_TYPE` | Database driver (`sqlite` or `postgres`) | Yes | `sqlite` |
| `DATABASE_URL` | Connection string or SQLite path | Yes | `./apiproof.db` |
| `GITHUB_APP_ID` | GitHub App numeric ID | Yes (in prod) | - |
| `GITHUB_APP_PRIVATE_KEY` | RSA private key PEM for GitHub App JWTs | Yes (in prod) | - |
| `GITHUB_CLIENT_ID` | OAuth Client ID for GitHub App | Yes (in prod) | - |
| `GITHUB_CLIENT_SECRET` | OAuth Client Secret for GitHub App | Yes (in prod) | - |
| `GITHUB_WEBHOOK_SECRET` | Secret for HMAC SHA-256 webhook signature validation | Yes (in prod) | - |
| `WORKER_SECRET` | Secret token protecting `/api/internal/scan-worker` | Yes | - |
| `SESSION_SECRET` | HMAC secret key for cookie session signing | Yes | - |

---

## 12. Production Deployment

### Production Checklist
1. Deploy Next.js App Router on Vercel, Node.js server, or Container runtime.
2. Configure PostgreSQL database (`DATABASE_TYPE=postgres`, `DATABASE_URL=postgres://...`).
3. Register and configure the production GitHub App.
4. Set up periodic cron job or background service pinging `POST /api/internal/scan-worker` with `WORKER_SECRET`.
5. Verify SSL/TLS certificates and CSRF origin protection headers.
