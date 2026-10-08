# Controlled Staging Scan Runbook

This procedure is intentionally stopped before remote enqueue or worker execution until explicit approval is provided.

## Target

- Repository: `ravitejabolla756-sys/my-owl-staging-affected-openai`
- GitHub repository ID: `1408947921`
- Expected branch: `main`
- Expected compatibility rule: `openai-gpt-4-5-preview-removal-2025-07-14`
- Expected model: `gpt-4.5-preview`
- Expected result: `AFFECTED`

## Preconditions

Verify values without printing them:

```text
APIPROOF_PREVIEW_STAGING_ISOLATION=true
APIPROOF_DATABASE_URL=<staging secret present>
DATABASE_URL=<unset>
PROVIDER_INTELLIGENCE_V1_ENABLED=true
APIPROOF_ENABLE_LIVE_GITHUB=true
APIPROOF_ENABLE_LIVE_GITHUB_WRITE=false
CRON_SECRET=<present>
```

Verify the active GitHub installation and repository rows are staging-only, active, and associated with the approved repository. Verify migrations and the required queue, scan, finding, installation, and repository tables exist. Do not reveal credentials or connection strings.

## Enqueue gate

The worker requires an existing pending `github_scan_requests` row. Use exactly one of these, only after explicit approval:

1. A signed push webhook for the approved staging repository; or
2. A staging-only transaction that resolves repository ID `1408947921`, inserts one pending request for the exact 40-character target commit and `refs/heads/main`, and relies on the unique repository/commit constraint.

Do not use a generic production enqueue path or `DATABASE_URL` fallback.

## Worker invocation

After the enqueue succeeds, call the protected route with Vercel Deployment Protection bypass and internal authorization as required by the deployment:

```http
POST /api/internal/scan-worker
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
```

```json
{"batchSize":1,"timeoutMs":50000}
```

Do not place the secret in logs, screenshots, or reports.

## Read-only verification

Verify the request and scan are completed, the target commit SHA is retained, and the persisted result contains a finding with:

```text
provider = openai
changeId = openai-gpt-4-5-preview-removal-2025-07-14
model = gpt-4.5-preview
status = AFFECTED
```

Verify the authenticated Compatibility Proof/API and Compatibility Map responses. Do not use an unauthenticated diagnostic and do not treat a `200` health response as scan evidence.
