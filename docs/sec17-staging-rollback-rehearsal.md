# SEC-17 — Staging Deployment Rollback Rehearsal Plan

Status: preparation only. No deployment, hosting-account inspection, rollback, or production action was performed for this document.

## Verified repository facts

- `apps/web/vercel.json` declares the Vercel framework as `nextjs`.
- The repository contains no verified Vercel project link or hosting-account configuration in this worktree.
- A repository config file does not establish the active hosting provider, project root, production/staging aliases, deploy triggers, environment variables, immutable deployment history, rollback controls, or current production deployment.
- Therefore SEC-17 remains `BLOCKED` until the hosting owner confirms these details and authorizes an isolated staging rehearsal.

## Required approvals and evidence before rehearsal

The hosting owner must identify and approve:

1. The actual hosting project, application root, staging environment/alias, and production environment/alias.
2. Which branch and event can create or promote deployments, including whether feature-branch pushes create preview deployments.
3. The known-good staging deployment ID and source commit, and the platform-supported method to restore it.
4. A rehearsal window, operator, observer, abort contact, and explicit permission to deploy and roll back staging.
5. Health, error-rate, latency, queue, authentication, webhook, and tenant-isolation acceptance thresholds for the rehearsal.
6. Database migration compatibility and rollback/forward-fix strategy for the candidate. No destructive database rollback is part of this plan.

Record environment-variable **names and presence only** in evidence; never copy secret values into this document or logs.

## Rehearsal procedure after approval

1. Confirm the candidate commit, clean build, required CI checks, and a known-good staging deployment. Confirm the candidate has not been promoted to production.
2. Capture the current staging deployment ID, source commit, health observations, and relevant queue/error baselines.
3. Deploy the candidate to staging using the hosting owner's approved mechanism. Record the deployment ID and commit; do not change environment settings during the rehearsal.
4. Run the approved smoke suite: health endpoint, login/session, workspace authorization and cross-tenant denial, key dashboard reads, webhook signature rejection/acceptance fixtures, and worker/scheduler health. Use test identities and synthetic data only.
5. Observe the pre-approved monitoring window and compare measurements to thresholds. Do not invent or relax thresholds during the run.
6. If a rollback trigger is met, stop further promotion and use the verified platform mechanism to restore the recorded known-good staging deployment. Do not force-push, edit hosting settings, or run ad hoc/destructive database rollback commands.
7. Verify the restored deployment ID/commit, health and smoke flows, tenant isolation, queue state, and absence of unintended production promotion. Record any migration state requiring a separately approved forward fix.
8. Preserve deployment IDs, timestamps, commit SHAs, sanitized logs, test results, threshold decisions, rollback operator, and final staging state in the release evidence packet.

## Abort conditions

Abort before deploying if project/environment identity is ambiguous, staging is not isolated, the known-good deployment cannot be restored, a test could contact production services/data, required thresholds are missing, the candidate has incompatible/destructive migrations without an approved recovery plan, or production promotion is coupled to the proposed action.

## Exit criteria

SEC-17 can move beyond `BLOCKED` only after an authorized rehearsal records candidate and restored deployment identities, passes approved smoke/monitoring thresholds, and verifies database compatibility and staging isolation. This plan alone is not rehearsal evidence and is not production approval.
