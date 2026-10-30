# APIProof v1.0 — Pilot Setup & External Validation Guide

This document provides step-by-step instructions for setting up and running a real-world pilot of **APIProof v1.0** with external developers or organizations.

---

## 1. System Requirements

- **Node.js**: `^22.14.0`
- **pnpm**: `^10.0.0`
- **Database**: PostgreSQL (Production) or SQLite (Development/Local)
- **Domain / Host**: Publicly reachable HTTPS URL (or tunnel service like `ngrok` for testing webhooks locally)
- **Verification runtime**: A usable Docker Linux engine with the preloaded pinned verifier image; a web-only serverless deployment is not proof of Docker availability.

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
MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST=sha256_digest_of_the_frozen_reviewed_registry

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

APIProof processes scans asynchronously through the bounded `/api/internal/scheduled-rescan` orchestrator. It queues stale repositories and invokes the worker with the required scope. Set up the orchestrator rather than calling the worker without a repository scope:

### Option A: Vercel Cron (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/internal/scheduled-rescan",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Option B: Linux `crontab` or Systemd Timer
```bash
0 2 * * * curl -X POST https://your-domain.com/api/internal/scheduled-rescan -H "Authorization: Bearer YOUR_CRON_SECRET"
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
| 10 | **Migration Proposal** | Locally verified | Local Docker and regression tests | Applies the exact-baseline patch and requires successful execution-bound evidence before GitHub writes. |
| 11 | **Draft PR Creation** | Runtime/configuration dependent | Must be verified per deployment | Creates an isolated deterministic branch and Draft PR from complete resulting source. Production fails closed if live write or Docker verification is unavailable; no fake transport fallback. |
| 12 | **Activity / History** | ✅ Works | Locally Verified | Provides chronological workspace audit trail of scans, findings, PRs, and installation events. |
| 13 | **Error Recovery** | ✅ Works | Locally Verified | Persists detailed failure messages; auto-retries transient worker errors up to 3 attempts. |
| 14 | **Disconnect / Reconnect** | ✅ Works | Locally Verified | Toggles repo monitoring status without losing historical findings or PR records. |
| 15 | **Installation Deletion / Suspension** | ✅ Works | Production Configured | Webhooks `installation.deleted` / `suspend` update installation state to prevent unauthorized scans. |

---

## 6. Verification Categorization

- **Locally Verified**: User Auth, Workspace Tenancy, Repository Connection, HMAC Webhook Validation, Atomic Scan Claiming, Deterministic AST Engine, Migration Patch Generation, Draft PR Safety Guards, Activity Audit Logs, Plan Limit Enforcement.
- **Mocked / Fake Transport (Tests/Local Development Only)**: Fake GitHub Write Transport is forbidden in production. Dedicated synthetic repository/source fixtures are available only to automated tests. Billing provider behavior is separate from migration verification.
- **Production-Configured**: GitHub App Installation Flow, Live GitHub App Token Fetching, Live GitHub Webhooks, Live GitHub Draft PR Creation.
- **Genuinely Live-Verified**: Tested against real GitHub App credentials & webhook payloads in previous phase verifications.

---

## 7. Pilot Execution Instructions

1. Deploy APIProof to a production web host (Vercel, AWS App Runner, Railway, or Docker).
2. Set up PostgreSQL and run initial database schema initialization.
3. Configure the 5 required GitHub App environment variables.
4. Set up the authenticated `POST /api/internal/scheduled-rescan` cron; do not invoke the worker without an exact repository scope.
5. Invite external pilot users to sign up at `/login`.
6. Pilot users connect their GitHub App installation, select repositories, and push a test commit containing target vendor API calls.
7. Verify that scans execute asynchronously and finding cards populate in `/dashboard/findings`.
8. Test generating migration plans and creating draft PRs on GitHub.

## 8. Beta-hardening release candidate — 2026-10-02

This is a local, reviewed release candidate on `main`, based on
`3ef5126179b99ba86e1150ab0cc3e6a22855c9d7`. No commit, push, deployment,
production data/configuration change, or GitHub PR modification was performed.
The deployed application has not been upgraded by this preparation.

### Release boundaries and runtime requirements

- Production repository connection requires a GitHub repository ID resolved by
  the authenticated workspace installation. Synthetic connection/source paths
  are not production fallbacks; dedicated source fixtures are test-only.
- Proposals apply the deterministic patch to exact scan-SHA source, then provision
  dependencies and execute INSTALL, BUILD, TYPECHECK, and TEST in one isolated
  Docker container. Stage outcomes use Docker process exit codes, not repository
  stdout. Missing/failed execution cannot authorize a production proposal.
- Artifact acquisition runs in a separate, bounded Docker helper with package
  metadata only and lifecycle scripts disabled. It does not execute repository
  source on the host. Cache contents and captured metadata are digest-checked.
- Verification uses `node:22.14.0-alpine3.21`, `--pull=never`,
  `--network=none`, read-only source/config and package-artifact mounts, and
  container-local dependency storage. pnpm project bookkeeping is container-local;
  package content remains read-only.
- Supported managers are pinned pnpm 10.30.3, npm 10.9.2, and Yarn Classic 1.22.22.
  A single matching root lockfile is required. Yarn Berry/conflicting metadata,
  credential-bearing dependency metadata, unavailable artifacts, and missing
  TypeScript/Vitest tooling fail closed. The configured BUILD gate runs
  `tsc --noEmit`; this is not a promise to execute arbitrary customer build scripts.
- The production proposal runtime must actually provide Docker, the preloaded
  pinned image, bounded writable temporary storage, and access to public package
  artifacts during acquisition. A successful Next.js build or Vercel web deployment
  does not prove that this execution runtime exists. This task did not verify or
  change that production runtime.
- GitHub default branch and exact HEAD are revalidated before writing; no implicit
  `main` fallback is accepted. Migration branches cannot modify the authoritative
  default branch. Draft-only/no-auto-merge, scope/digest checks, tenant isolation,
  and idempotent reconciliation remain enforced.
- New PR bodies describe the signed persisted execution report and actual stage
  results. Historical PRs (including PR #3) are not edited by this release.
- Signed pull_request webhooks synchronize draft/open/closed/merged local state.
  The GitHub App must deliver the existing supported `pull_request` event; this
  task did not change App subscriptions or permissions.
- Plans are not labeled verified. Registry-reviewed compatibility rules are not
  represented as human repository review. Expired/revoked sessions revalidate
  against the server; transient failures do not sign out a validated session.
  Failed logout does not claim success.

### Local verification results

| Check | Result |
| --- | --- |
| Focused release regressions | 389 passed across 30 test files |
| Opt-in real Docker proof | 4 passed; pnpm deterministic migration and npm offline four-stage execution |
| Full `pnpm test` | 654 passed; 4 opt-in Docker tests skipped here and passed separately |
| `pnpm lint` | Passed |
| `pnpm -r --workspace-concurrency=1 typecheck` | All six workspace packages passed |
| Extra root test-project typecheck | Ten existing repository-route `@/lib/...` TS2307 errors remain |
| `pnpm build` | Passed with normal local process permissions |
| `git diff --check` | Passed |

Restricted execution initially encountered Windows spawn EPERM. The normal-permissions
build passed without an application workaround. Existing build warnings remain:
optional `source-map-support` resolution in ts-morph, Next.js ESLint-plugin detection,
and experimental Node SQLite. Yarn has command/policy regression coverage, but this
release's real Docker proofs cover pnpm and npm, not a Yarn installation.

### Exact release allowlist (74 files)

Only these reviewed source/configuration/fixture/test/documentation paths belong
in the release commit. No files have been staged by this preparation.

```text
apps/web/src/app/api/compatibility-map/route.ts
apps/web/src/app/api/findings/[id]/route.ts
apps/web/src/app/api/findings/route.ts
apps/web/src/app/api/migrations/route.ts
apps/web/src/app/api/repositories/route.ts
apps/web/src/app/dashboard/activity/page.tsx
apps/web/src/app/dashboard/findings/[id]/page.tsx
apps/web/src/app/dashboard/findings/page.tsx
apps/web/src/app/dashboard/layout.tsx
apps/web/src/app/dashboard/migrations/page.tsx
apps/web/src/app/dashboard/pull-requests/page.tsx
apps/web/src/components/dashboard/compatibility-map.tsx
apps/web/src/components/dashboard/sidebar.tsx
apps/web/src/lib/activity-utils.ts
apps/web/src/lib/compatibility-map-labels.ts
apps/web/src/lib/server/github-webhooks.ts
apps/web/src/lib/server/migration-lifecycle.ts
apps/web/src/lib/server/migration-proof.ts
apps/web/src/lib/server/migration-verification.ts
apps/web/src/lib/server/planning-service.ts
apps/web/src/lib/server/proposal-service.ts
apps/web/src/lib/server/scan-service.ts
apps/web/src/lib/server/workspace-service.ts
apps/web/src/lib/session-logout.ts
apps/web/src/lib/session-revalidation.ts
docs/pilot-setup-guide.md
evaluation-verification/manifest.json
packages/core/src/github/branch-policy.ts
packages/core/src/github/fake-write-transport.ts
packages/core/src/github/live-provider.ts
packages/core/src/github/migrate-live.ts
packages/core/src/github/write-contract.ts
packages/core/src/github/write-transport.ts
packages/core/src/patching/workspace.ts
packages/core/src/verification/artifact-integrity.ts
packages/core/src/verification/docker-process.ts
packages/core/src/verification/index.ts
packages/core/src/verification/orchestrator.ts
packages/core/src/verification/provisioning.ts
packages/core/src/verification/sandbox.ts
packages/core/src/verification/workspace.ts
packages/shared/src/verification.ts
test-fixtures/verification-minimal/package-lock.json
test-fixtures/verification-minimal/package.json
test-fixtures/verification-minimal/src/index.test.ts
test-fixtures/verification-minimal/src/index.ts
test-fixtures/verification-minimal/tsconfig.json
test-fixtures/verification-typescript/package.json
test-fixtures/verification-typescript/packages/contracts/package.json
test-fixtures/verification-typescript/pnpm-lock.yaml
test-fixtures/verification-typescript/pnpm-workspace.yaml
test-fixtures/verification-typescript/src/billing.test.ts
test-fixtures/verification-typescript/src/billing.ts
test-fixtures/verification-typescript/tsconfig.json
test-fixtures/verification-typescript/tsconfig.test.json
tests/activity-timestamp.test.ts
tests/authoritative-default-metadata.test.ts
tests/compatibility-map-api.test.ts
tests/compatibility-map-labels.test.ts
tests/docker-sandbox-sequence.test.ts
tests/docker-verification-live.test.ts
tests/github-pull-request-webhook.test.ts
tests/github-safety.test.ts
tests/migration-lifecycle.test.ts
tests/migration-proof.test.ts
tests/migration-verification-boundary.test.ts
tests/phase3-github-onboarding.test.ts
tests/proposal-recovery.test.ts
tests/repositories-list-route.test.ts
tests/session-logout.test.ts
tests/session-revalidation.test.ts
tests/verification-workspace.test.ts
tests/verification.test.ts
tests/web-backend.test.ts
```

### Preserve but exclude

Do not include `.pnpm-store/`, `CLONED/`, `design-references/`,
`LOGO.jpeg`, `logo.png`, `product_tracing_visual.png`, generated build/runtime
outputs, or any environment/PEM/key/credential file. The existing tracked
`.env.example` is an unchanged public template, not part of this release.
No database migration, billing behavior, password hashing, GitHub credentials,
or GitHub permission change is included.
