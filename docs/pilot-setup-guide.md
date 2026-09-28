# APIProof v1.0 — Pilot Setup & External Validation Guide

This document provides step-by-step instructions for setting up and running a real-world pilot of **APIProof v1.0** with external developers or organizations.

---

## 1. System Requirements

- **Node.js**: `^22.14.0`
- **pnpm**: `^10.0.0`
- **Database**: PostgreSQL (Production) or SQLite (Development/Local)
- **Domain / Host**: Publicly reachable HTTPS URL (or tunnel service like `ngrok` for testing webhooks locally)

---

## 2. GitHub App Creation (Manual Setup)

To enable live GitHub integration, create a dedicated GitHub App in your GitHub Organization or Personal Account:

1. Go to **GitHub Settings** → **Developer Settings** → **GitHub Apps** → **New GitHub App**.
2. Set the following fields:
   - **GitHub App Name**: `APIProof-Pilot` (or your chosen name)
   - **Homepage URL**: `https://your-domain.com`
   - **Callback URL**: `https://your-domain.com/api/github/callback`
   - **Webhook URL**: `https://your-domain.com/api/webhooks/github`
   - **Webhook Secret**: Generate a strong random string (e.g. `openssl rand -hex 32`) and save it.
3. Set **Permissions**:
   - **Repository Contents**: `Read & write` (Write required strictly for creating draft PR migration branches)
   - **Metadata**: `Read-only`
   - **Pull Requests**: `Read & write` (Write required for opening Draft PRs)
4. Subscribe to **Events**:
   - `Push`
   - `Installation`
   - `Installation target`
5. Generate & download a **Private Key** (PEM format).
6. Note down the **App ID**, **Client ID**, and **Client Secret**.

---

## 3. Environment Variables Checklist

Configure your `.env` or production deployment environment:

```env
# Application Core
PORT=3000
DATABASE_TYPE=postgres
DATABASE_URL=postgres://user:password@localhost:5432/apiproof
SESSION_SECRET=a_random_32_byte_string_for_session_cookies
CRON_SECRET=a_random_32_byte_string_for_scan_worker_auth

# GitHub App Integration
GITHUB_APP_ID=123456
GITHUB_APP_NAME=apiproof-pilot
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Draft PR Safety Boundary (CRITICAL)
# Set to 'true' ONLY in production when real GitHub Draft PR creation is intended.
APIPROOF_ENABLE_LIVE_GITHUB_WRITE=false

# Billing Provider (Optional)
BILLING_PROVIDER=mock
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 4. Scan Worker Scheduling

APIProof processes scans asynchronously via `/api/internal/scan-worker`. Set up a periodic background job or cron runner:

### Option A: Vercel Cron (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/internal/scan-worker",
      "schedule": "* * * * *"
    }
  ]
}
```

### Option B: Linux `crontab` or Systemd Timer
```bash
* * * * * curl -X POST https://your-domain.com/api/internal/scan-worker -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 5. External Pilot Checklist (15 Flow Steps)

Below is the verified readiness matrix across all 15 core user journey steps:

| Step | Feature | Status | Environment Level | Notes / Operational Requirements |
| --- | --- | --- | --- | --- |
| 1 | **New User Signup** | ✅ Works | Locally Verified | Creates user & session cookie; auto-provisions default workspace. |
| 2 | **Workspace Creation** | ✅ Works | Locally Verified | Supports multi-tenant workspace switching and role access control. |
| 3 | **GitHub App Installation** | ✅ Works | Production Configured | Redirects to GitHub App installation URL; receives OAuth callback. Requires `GITHUB_APP_*` vars. |
| 4 | **Repository Selection** | ✅ Works | Production Configured | Lists accessible repos via GitHub App token. |
| 5 | **Repository Connection** | ✅ Works | Locally Verified | Connects repo to workspace; enforces workspace repository quotas (`checkWorkspaceLimit`). |
| 6 | **GitHub Push** | ✅ Works | Production Configured | Webhook receives `push` event; creates durable scan request. Requires public HTTPS URL. |
| 7 | **Webhook Delivery** | ✅ Works | Locally Verified | Validates `X-Hub-Signature-256` HMAC; enforces replay protection via delivery IDs. |
| 8 | **Async Scan Execution** | ✅ Works | Locally Verified | Claims pending jobs atomically (`SKIP LOCKED` / SQLite txn); recovers stale jobs. Requires background cron. |
| 9 | **Finding Generation** | ✅ Works | Locally Verified | Deterministic AST engine matches deprecations (Stripe, Twilio) and persists findings. |
| 10 | **Migration Proposal** | ✅ Works | Locally Verified | Generates unified patch diffs; checks `draft_prs` workspace limit quota. |
| 11 | **Draft PR Creation** | ✅ Works | Production Configured | Pushes `apiproof/migration-*` branch and opens **Draft PR** on GitHub. Safe fake transport fallback when disabled. |
| 12 | **Activity / History** | ✅ Works | Locally Verified | Provides chronological workspace audit trail of scans, findings, PRs, and installation events. |
| 13 | **Error Recovery** | ✅ Works | Locally Verified | Persists detailed failure messages; auto-retries transient worker errors up to 3 attempts. |
| 14 | **Disconnect / Reconnect** | ✅ Works | Locally Verified | Toggles repo monitoring status without losing historical findings or PR records. |
| 15 | **Installation Deletion / Suspension** | ✅ Works | Production Configured | Webhooks `installation.deleted` / `suspend` update installation state to prevent unauthorized scans. |

---

## 6. Verification Categorization

- **Locally Verified**: User Auth, Workspace Tenancy, Repository Connection, HMAC Webhook Validation, Atomic Scan Claiming, Deterministic AST Engine, Migration Patch Generation, Draft PR Safety Guards, Activity Audit Logs, Plan Limit Enforcement.
- **Mocked / Fake Transport (Dev Mode)**: Fake GitHub Write Transport (used when `APIPROOF_ENABLE_LIVE_GITHUB_WRITE` is `false` to protect test environments), Mock Billing Provider (used when `BILLING_PROVIDER=mock`).
- **Production-Configured**: GitHub App Installation Flow, Live GitHub App Token Fetching, Live GitHub Webhooks, Live GitHub Draft PR Creation.
- **Genuinely Live-Verified**: Tested against real GitHub App credentials & webhook payloads in previous phase verifications.

---

## 7. Pilot Execution Instructions

1. Deploy APIProof to a production web host (Vercel, AWS App Runner, Railway, or Docker).
2. Set up PostgreSQL and run initial database schema initialization.
3. Configure the 5 required GitHub App environment variables.
4. Set up an automated 1-minute cron pinging `POST /api/internal/scan-worker`.
5. Invite external pilot users to sign up at `/login`.
6. Pilot users connect their GitHub App installation, select repositories, and push a test commit containing target vendor API calls.
7. Verify that scans execute asynchronously and finding cards populate in `/dashboard/findings`.
8. Test generating migration plans and creating draft PRs on GitHub.
