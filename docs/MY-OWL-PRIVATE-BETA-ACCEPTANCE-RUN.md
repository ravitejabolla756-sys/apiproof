# MY OWL Private-Beta Acceptance Run

This run is the minimum live evidence needed before inviting a private-beta tenant. It is deliberately narrow: one authenticated workspace, one approved repository, one exact commit, and one review-only Draft PR. It does not authorize a merge, a default-branch write, or a public launch.

## Operator sequence

1. Freeze a clean release commit and record its SHA and provider-registry digest.
2. Sign in with the approved test workspace and install the MY OWL GitHub App for one repository.
3. Confirm the repository picker shows the expected owner, repository ID, and default branch.
4. Start a scan and record the exact commit SHA, scan ID, and persisted result.
5. Confirm a finding contains the repository path, line, rule/change ID, and official source evidence.
6. Open the provider-rule review queue at `/dashboard/rules/pending` and review candidates in priority order: `P0` first, then `P1`, then `P2`. Use the candidate's evidence pack to inspect official source claims, detector tokens, fixture outcomes, and remediation limitations.
7. Approve the corresponding provider candidate only after recording one affected, one unaffected, and one uncertain fixture outcome with reviewer notes. Confirm a rescan job is queued for that workspace and repository.
8. Confirm the worker completes the rescan and records the result against the approved change and exact repository revision.
9. For a reviewed deterministic template only, request verification and a Draft PR. Confirm GitHub reports a Draft PR on an isolated `apiproof/*` branch. Do not promote review-only candidates or candidates whose remediation is unavailable.
10. Confirm no write occurred on the default branch and that no merge or auto-merge is enabled.
11. Exercise webhook signature, replay, retry, duplicate-delivery, tenant-isolation, billing/notification, backup/restore, and rollback checks.

## Evidence manifest

Before the operator sequence, the deployed status boundary can be checked without triggering a scan or rescan:

```powershell
$env:MY_OWL_BETA_BASE_URL = 'https://your-deployed-host.example'
$env:CRON_SECRET = '<secret from the deployment secret manager>'
$env:MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST = '<sha256 digest recorded for the frozen release>'
pnpm beta:live-preflight
```

The preflight checks the authenticated status endpoint, the exact 19-source catalog, HTTPS source boundaries, runtime identity, exact provider-registry digest match, six-hour source freshness, and queue metric shape. It never prints `CRON_SECRET` and never invokes a mutating route. A passing preflight is necessary but is not a substitute for the full acceptance run below.

After the operator sequence is complete, the guarded capture command can create the manifest without hand-editing JSON. It refuses to write unless the live preflight passes, the release SHA exactly matches the deployed runtime SHA, the registry digest matches, and all acceptance identifiers and checklist references are supplied:

```powershell
$env:MY_OWL_BETA_RELEASE_COMMIT = '<exact deployed commit SHA>'
$env:MY_OWL_BETA_OPERATOR = 'operator@example.com'
$env:MY_OWL_BETA_EVIDENCE_MANIFEST = 'docs/evidence/private-beta-2026-10-29.json'
$env:MY_OWL_BETA_EVIDENCE_ACCEPTANCE_JSON = '{"tenantId":"...","repositoryId":"...","repositoryFullName":"owner/repo","defaultBranch":"main","commitSha":"...","scanId":"...","findingId":"...","rescanJobId":"...","migrationId":"...","draftPullRequestUrl":"https://github.com/owner/repo/pull/123","defaultBranchWriteObserved":false}'
$env:MY_OWL_BETA_EVIDENCE_REFERENCES_JSON = '{"githubOnboarding":"...","exactCommitScan":"...","persistedFinding":"...","approvalTriggeredRescan":"...","draftPullRequest":"...","webhookReplayAndDeduplication":"...","scheduledJobs":"...","productionConfiguration":"...","backupAndRestore":"...","tenantIsolation":"...","billingAndNotifications":"...","rollback":"..."}'
pnpm beta:capture-evidence
```

Use `--overwrite` only when intentionally replacing an existing evidence record. Then set `MY_OWL_BETA_EVIDENCE_MANIFEST` to the same repository-local path when running `pnpm beta:readiness`.

The validator requires:

- release commit and provider-registry SHA-256 digest;
- tenant, repository, default branch, exact commit, scan, finding, rescan, migration, and GitHub Draft PR identifiers;
- a GitHub HTTPS Draft PR URL;
- an explicit assertion that the default branch was not written;
- passing, timestamped references for every live checklist category.

The readiness command rejects missing, malformed, absolute, outside-repository, non-JSON, or non-passing evidence. Never put tokens, cookies, private keys, database URLs, or source secrets in the manifest; references should be sanitized log URLs, IDs, or operator notes.

## Acceptance boundary

This run proves the bounded private-beta path only. It does not prove comprehensive API-change detection, every provider's migration support, full customer CI equivalence, production-scale capacity, or public-beta readiness. Those remain separate gates in `MY-OWL-BETA-DEPLOYMENT-CHECKLIST.md`.
