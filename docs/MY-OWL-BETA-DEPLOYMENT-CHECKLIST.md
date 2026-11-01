# MY OWL Beta Deployment Checklist

This checklist is the release gate for the provider-intelligence beta. A green local check is not a substitute for the corresponding live check.

Run `pnpm beta:readiness` before freezing a release. It is read-only and emits a machine-readable inventory gate; it deliberately fails while the tree is dirty, reviewed-rule breadth is incomplete, or live evidence is absent. Set `MY_OWL_BETA_EVIDENCE_MANIFEST` only to a checked-in repository-local JSON manifest that satisfies the schema in `apps/web/src/lib/server/beta-evidence.ts`, after the live GitHub, cron, production-configuration, backup, restore, and rollback checks have actually been performed. A file that merely exists is not evidence.

Scheduler decision (2026-10-30): the linked Vercel project is on Hobby, so the required six-hour schedule is maintained in `.github/workflows/my-owl-scheduler.yml` instead of Vercel Cron. Before release, configure the production repository's `MY_OWL_APP_URL` Actions variable and `CRON_SECRET` Actions secret, then run each workflow job manually once and verify its logs. The MY OWL workspace Pro flag is application billing state and does not upgrade the Vercel account.

## Local release gates

- [x] Provider-intelligence regression suite passes.
- [x] Full local suite passes (150 files passed, 1 skipped; 1,282 tests passed, 4 skipped in the latest host-level serial run).
- [x] Repository-wide typecheck passes in the current workspace.
- [x] Repository-wide ESLint passes (`pnpm lint`) in the current checkout.
- [ ] The optimized Next.js production build is stable with CI-style settings. An earlier isolated Windows run generated all 59 routes, but fresh single-worker retries currently fail nondeterministically with Windows `EPERM` errors while Next.js creates generated App Router output. Ubuntu CI remains the authoritative build gate until this local instability is resolved or independently reproduced as harmless.

Windows verification command for a fresh, non-cached diagnostic build:
`$env:NEXT_DIST_DIR='.next-proof-<unique-id>'; pnpm --filter @apiproof/web build`
This passed all 59 routes on 2026-10-30. Next.js may update generated type references during this diagnostic; restore those generated-only changes before evaluating worktree cleanliness. The frozen release must still pass the Ubuntu CI build.
- [x] Changelog sources are HTTPS-only, bounded, timeout-protected, and redirect-allowlisted.
- [x] Transient provider-source failures retry with bounded backoff, honor bounded `Retry-After` guidance, and keep non-retryable and unsafe sources fail closed.
- [x] Candidate approval requires human review and source evidence.
- [x] The official evidence catalog can be materialized idempotently with `pnpm provider:seed-review-queue`; it creates only `needs_review` candidates and no rescan jobs or approved rules.
- [x] Dynamic rules are workspace-scoped.
- [x] Rescan approval, queueing, worker execution, persisted finding, and feature-flag rollback have local integration proof.
- [x] Existing migration proposals remain draft-only and do not merge or write the default branch.
- [x] Dynamic findings retain bounded redacted source evidence and an exact file digest; local integration covers reviewed template verification through an isolated Draft PR without default-branch writes.
- [x] `pnpm release:manifest` records the commit, provider-registry digest, official-candidate/reviewed-rule inventory, verified-template inventory, and required cron schedules; it fails on a dirty checkout or an incomplete reviewed-rule catalog.
- [x] CI runs `pnpm providers:validate:all` and `pnpm providers:validate:multi` before the test/build/release-manifest gates, covering the 19-provider catalog and cross-provider isolation.

Run the optimized build from a clean release checkout and confirm the Ubuntu GitHub Actions build before closing the release gate. The local CI-style build is evidence that the source can compile, but it does not replace a clean frozen-release or Ubuntu CI result.

## Live checks required before beta invitation

- [ ] Freeze an exact clean release commit and record its provider-registry digest.
- [ ] Generate and archive the release manifest from that clean commit; use its registry digest as the expected deployment identity.
- [ ] Confirm the GitHub Actions `CI` workflow passes on Ubuntu, including the optimized production build (`pnpm -r build`).
- [ ] Confirm the deployed Vercel build uses that release commit.
- [x] Confirm a production deployment compiles and publishes all 59 application routes (deployment `6NPivB3yQFppUrEWfK4vBa64n2Pb`, 2026-10-30). This is deployment evidence, not a frozen-release identity check.
- [x] Confirm `/api/health` reports `healthy` with `database: connected` on the deployment URL and stable production alias.
- [x] Confirm the protected provider-intelligence status route returns JSON `Unauthorized` without the secret on both production URLs, rather than an HTML 404.
- [x] Confirm the production startup hook safely creates the provider-intelligence schema on the configured PostgreSQL database, then repeat the live scan smoke test. Stable alias returned healthy with `database: connected`; `my-owl-beta-smoke-test` completed a real GitHub scan with 0 findings on 2026-10-30.
- [ ] Set and verify `CRON_SECRET` without exposing its value.
- [ ] Set `MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST` to the digest recorded for the frozen release; live preflight must report an exact digest match.
- [ ] Invoke the protected `/api/internal/provider-intelligence/status` endpoint and record:
  - [ ] `runtime.productizationV1Enabled` is intentionally set.
  - [ ] All 19 catalog sources appear.
  - [ ] Source health and parser status are expected.
  - [ ] Review, rescan, and scan-worker queues are bounded.
- [ ] Confirm the GitHub Actions six-hour provider-changelog schedule is enabled on the default branch and produces a successful log entry.
- [ ] Run `pnpm beta:live-preflight`; all 19 source records must show a successful fetch no older than six hours, and the deployed provider-registry digest must exactly match the frozen release digest.
- [ ] Confirm the GitHub Actions nightly scheduled-rescan schedule is enabled on the default branch and produces a successful log entry.
- [ ] Complete one bounded GitHub onboarding-to-scan smoke test with an approved test tenant.
- [ ] Record the run in the structured manifest described in `docs/MY-OWL-PRIVATE-BETA-ACCEPTANCE-RUN.md` and validate it with `pnpm beta:readiness`.
- [ ] Verify repository, installation, workspace, and finding authorization boundaries.
- [ ] Verify webhook signature, replay, retry, and duplicate-delivery behavior.
- [ ] Confirm database migrations, backups, restore rehearsal, logging, metrics, and alerts.
- [ ] Confirm billing limits and Slack authorization/notification behavior.
- [ ] Record the live rollback action: disable the provider-intelligence flag, restart/redeploy, and verify the legacy path.

## Provider capability gate

- [ ] Treat all 19 providers as source-monitoring coverage only until each provider has a reviewed compatibility rule and scan fixture.
- [ ] Reach the roadmap rule-volume target: at least 50 approved, evidence-backed reviewed rules.
- [ ] Reach executable migration breadth: every launch provider has at least one digest-bound, fixture-verified template before it is marketed as auto-fix capable.
- [ ] Promote a provider to deterministic auto-fix only after digest-bound AST transformations, positive/negative fixtures, syntax verification, and human review pass.
- [ ] Keep review-only providers from being represented as auto-fix capable in product copy or customer documentation.
- [ ] Generate and review the complete evidence pack with `pnpm provider:review-pack`; do not approve candidates from titles or summaries alone.
- [ ] Review candidates from `/dashboard/rules/pending` in P0, P1, P2 order. Record affected, unaffected, and uncertain fixture outcomes and keep candidates without executable templates review-only.
- [ ] Re-run the pack after every source refresh and reject any review whose source, evidence, or candidate fingerprint changed.

## Rollback

If a live check fails, disable `PROVIDER_INTELLIGENCE_V1_ENABLED`, stop the affected cron or worker invocation, preserve evidence, and redeploy the last known-good release. Do not delete scan records or modify customer repositories as a rollback mechanism.

