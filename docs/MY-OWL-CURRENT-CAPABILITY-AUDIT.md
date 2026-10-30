# MY OWL — Current Capability and Compatibility Audit

Audit date: 2026-10-30 (Asia/Calcutta)

> This document was refreshed against the current `C:\YC` working tree. Older
> workspace paths and counts in the historical sections below are retained only
> where they explain prior evidence; the current launch decision is governed by
> `docs/MY-OWL-BETA-READINESS-GAPS.md` and
> `docs/MY-OWL-PROVIDER-CHANGE-CAPABILITY.md`.

## Scope and evidence policy

This is a read-only audit of:

- Current provider workspace: `C:\YC`
- Historical comparison workspaces are not treated as current release artifacts.

Claims below are based on the current working trees, direct source reads, and non-destructive local commands. The workspaces were already dirty; no existing change was reset, repaired, deleted, merged, deployed, or combined. Graph results were used for structure only and were qualified with direct source reads because the graph reported metadata changes after indexing.

## 1. Repository verification

| Metric | Main provider workspace | Beta workspace |
|---|---|---|
| Branch | `provider-intelligence-staging` | `codex/my-owl-g3a-staging-rc` |
| HEAD | `c16d4d991686f28cf623624ae8cffc454ebf498a` | `caf586bb8b4e1236366bcd458e907b037bbde5fc` |
| HEAD subject | fix: include worker runtime identity | staging release candidate |
| Working-tree status | 251 porcelain entries: 143 tracked changes, 108 untracked | 2 local documentation/lint-ignore entries |
| Last committed checkpoint | 2026-10-13 22:59:19 +05:30 | 2026-10-07 17:15:55 +05:30 |
| Batch141 | No `batch141` source, manifest, or error reference is present. Registry duplicate guards and current provider validators pass. Historical resolution cannot be proven because the original error artifact is absent. | Same observation |
| Typecheck | `pnpm typecheck`: PASS on 2026-10-29 | current tree |
| Focused parser/review tests | PASS: 18 tests in the provider coverage, readiness, pipeline, and rule-scope suites | current tree |
| Full tests | PASS: 148 files, 1,272 tests; 1 skipped file and 4 skipped tests in the latest serial run | current tree |
| Build | Windows `EPERM` while creating nested Next.js output; Ubuntu CI remains required for release proof | current tree |

The main working tree differs substantially from `HEAD` (`git diff --stat`: 63 tracked files, 1,364 insertions, 2,019 deletions) and contains hundreds of untracked provider batches, fixtures, reports, and generated files. Any release decision must identify an exact commit or clean release candidate; “current workspace” is not a reproducible deployable artifact.

## 2. Exact provider coverage

Authoritative current main registry command:

```text
pnpm exec tsx --conditions=apiproof-source -e "import { DISCOVERY_PROVIDERS, PRODUCTION_COMPATIBILITY_REGISTRY, OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './packages/providers/src/index.ts'; ..."
```

Current main counts at the latest verified read:

| Metric | Count | Authoritative source |
|---|---:|---|
| Launch providers monitored | 19 | `PROVIDER_CHANGE_SOURCES` and `apps/web/vercel.json` |
| Discovery providers in launch catalog | 62 total discovery providers; 19 launch providers | `DISCOVERY_PROVIDERS` plus the launch capability matrix |
| Official review candidates | 50 | `OFFICIAL_CHANGE_CANDIDATE_REGISTRY`; promotion remains evidence-gated |
| Candidate provider coverage | all 19 launch providers | provider coverage invariant test |
| Evidence-reviewed local rules | 50 across all 19 launch providers | `PRODUCTION_COMPATIBILITY_REGISTRY` and reviewed production records |
| Launch-catalog reviewed projection | 50 across 19 launch providers | capability summary |
| Deterministic migration templates | 13 providers declare coverage; 15 rules across 12 providers are verified against human-reviewed bundled assets; the remainder stay review-only | `MIGRATION_TEMPLATE_COVERAGE`, `loadVerifiedMigrationTemplateIds` |
| Live production onboarding/scan proof | not verified | authenticated GitHub/Vercel run still required |

Current reviewed-rule coverage spans all 19 launch providers. The broader discovery catalog must not be read as compatibility support.

Discovery/catalog names, including providers without active rules, are in `MY-OWL-PRODUCTION-PROVIDER-INVENTORY.csv`. A catalog entry is not treated as compatibility support.

## 3. Compatibility rule inventory

Current local production registry contains **50 reviewed rules** across **19 launch providers**. The current validation suite exercises these registry boundaries plus candidate/replay paths; the full local suite passed on 2026-10-29. Therefore:

- Registered reviewed rules: 50
- Launch-catalog projection: 50 rules across 19 launch providers
- Independently exercised candidate/replay records: covered by the passing local test suite
- Candidate rules not promoted: additional official-source candidates remain review-gated until fixture evidence is recorded

The exact current rule inventory, official URLs, evidence dates, scope, conditions, severity, and validation status is in `MY-OWL-COMPATIBILITY-RULE-INVENTORY.csv`.

Rule records are loaded from `packages/providers/src/compatibility-registry.ts` and `local-reviewed-production-records.ts`. The evaluator is `packages/analyzers/src/typescript/compatibility.ts` (`evaluateRegisteredNormalizedCompatibility`). Matching is deterministic and fail-closed for dynamic or low-confidence evidence: provider identity, endpoint/operation, model, resource, parameter, response field, domain, auth/header, and API-version dimensions are matched conjunctively where present.

## 4. Detection capability today

| Detection type | Status | Evidence and limitation |
|---|---|---|
| Removed API endpoints | PARTIAL / WORKING for registered patterns | 10 reviewed rules include endpoint/resource cases; exact static patterns only |
| Deprecated API endpoints | PARTIAL | bounded endpoint rules such as Twilio `/Engagements`; no general deprecation ingestion |
| Removed SDK methods | PARTIAL | Slack `files.upload` is covered; SDK wrapper aliases and dynamic calls remain limited |
| Deprecated SDK methods | PARTIAL | only explicitly registered operations; no broad SDK semantic model |
| Authentication migrations | PARTIAL | Cloudflare service-key and Supabase anon-key conditions; static header/auth evidence only |
| Removed or renamed parameters | WORKING for reviewed static fixtures | Clerk and Anthropic parameter rules; computed/dynamic values become `NEEDS_REVIEW` |
| Version incompatibility | PARTIAL | package/lockfile/API-version evidence exists, but not every provider has version metadata or resolver support |
| Removed models | WORKING for reviewed model fixtures | OpenAI, Anthropic, ElevenLabs, and Groq exact model identifiers |
| Webhook/event contract changes | NOT IMPLEMENTED as a general production rule category | no general webhook schema registry or provider-wide event compatibility engine was demonstrated |
| Response schema changes | PARTIAL | GitHub response-field rule; not a general schema diff engine |
| Provider policy/rate-limit changes | NOT IMPLEMENTED as general compatibility detection | rate limiting in MY OWL is an application control, not provider-policy intelligence |

The system can locate exact file/line evidence when the analyzer extracts a static, high-confidence usage. It cannot promise accurate location for dynamic strings, computed property names, wrappers, generated code, reflection, runtime configuration, or unsupported language adapters.

## 5. Actual repository scanning path

Observed path: authenticated user/workspace → repository access check → workspace GitHub App installation → exact commit fetch → repository snapshot and static analyzers → provider discovery / productization → normalized usage IR → reviewed-rule matching → persisted findings and bounded proof evidence → dashboard APIs.

| Stage | Status | Evidence |
|---|---|---|
| Authentication and workspace membership | implemented; locally tested | `apps/web/src/lib/server/auth.ts`, workspace service, auth tests |
| GitHub authorization and repository boundary | implemented; locally tested | `github.ts`, `workspace-service.ts`, repository routes; live onboarding not verified |
| Fetch exact repository commit | implemented in async worker path | `scan-worker.ts`, `fetchRemoteRepositoryFiles`; baseline SHA mismatch fails closed |
| Static language analysis | implemented locally | TypeScript/JavaScript and Python analyzers plus Go, Java, Kotlin, and C# adapters are dispatched by the productization path when repository evidence is present |
| API-version evidence | IMPLEMENTED for static literals | Configured SDK client versions propagate into constructor and method-call evidence across curated and discovery-backed providers; dynamic configuration and runtime negotiation remain review-only. The Shopify detection→approval→exact-commit-rescan path is locally integrated and still uses mocked GitHub transport. |
| File/size limits | implemented | TypeScript snapshot: 5,000 files, 50,000 entries, depth 64, 1 MiB source file, 33,554,432 total bytes |
| Dependency/version interpretation | partial | package.json plus npm/pnpm/yarn lockfiles; Python requirements/pyproject/poetry/uv; Go go.mod/go.sum; no full compiler/build graph |
| Dynamic API usage | fail-closed / partial | low-confidence or unresolved evidence becomes `NEEDS_REVIEW` |
| Findings persistence and tenant boundary | implemented in local tests | workspace/repository predicates, idempotent finding upsert, bounded projections |
| Background worker | implemented locally | queue claim/lease/recovery and Vercel cron route; no production worker observation |
| Retry/failure behavior | implemented and tested locally | failed jobs, stale lease recovery, no fixture fallback for async GitHub scans |
| Cross-provider isolation | passing fixture evidence | `providers:validate:multi`: no provider interference, no duplicate finding IDs |
| Production end-to-end scan | NOT VERIFIED | no authenticated GitHub install → repository selection → scan → findings run was executed in this audit |

The shared language enum names nine languages (`typescript`, `javascript`, `python`, `go`, `java`, `kotlin`, `csharp`, `ruby`, `rust`), but the multi-language constructor currently registers six adapters. Ruby and Rust are not implemented adapters. Productization dispatches TypeScript/JavaScript, Python, Go, Java, Kotlin, and C# when those languages are evidenced; this is still static analysis, not compiler/type-checker or runtime-dataflow coverage.

## 6. Automation and intelligence

| Capability | Current status |
|---|---|
| Official changelog monitoring | IMPLEMENTED locally for 19 allowlisted sources | Six Tier-1 adapters plus 13 profiled-provider parsers; each runs through the six-hour cron route |
| Automatic new API-change discovery | IMPLEMENTED locally; production delivery unverified | Due-source refresh, content fingerprints, structured candidates, and review-only fallback are tested |
| Documentation ingestion | IMPLEMENTED locally; live external replay unverified | Source snapshots and provenance-bound candidate records are persisted |
| Evidence fingerprinting | implemented and tested in candidate review/promotion code |
| Candidate deduplication | implemented; duplicate IDs/source conflicts fail closed |
| AI-assisted candidate research | development-time/Codex research only; not SaaS automation evidence |
| Candidate promotion gates | implemented: human reviewer, fingerprints, official evidence, complete payload |
| Scheduled rescanning | IMPLEMENTED locally; production schedule execution unverified | Six-hour changelog refresh and nightly cron routes, durable leases, approval-triggered jobs, and worker reconciliation are tested |
| GitHub event-triggered scans | webhook and queue path exist; production delivery unverified |
| Developer notifications | Slack notification/action paths exist; end-user delivery unverified |
| Draft pull requests | migration proposal/Draft PR code exists; only the verified rule subset may produce guarded remediation; live GitHub write proof is still absent |

A manually run Codex research or validator command is not automatic MY OWL intelligence.

## 7. User-facing experience

| Feature | Assessment |
|---|---|
| Sign up / session | IMPLEMENTED; locally tested; staging/production not verified |
| Connect GitHub | IMPLEMENTED in source; live App installation and callback not verified |
| Install GitHub App | route/config exists; external App ID/slug/private key were not verified |
| Select repositories | implemented route/UI path; authenticated live path not verified |
| Trigger scans | implemented local synchronous and async paths; live repository scan not verified |
| See findings | implemented dashboard/API path; only fixture/local persistence evidence |
| Open source evidence | implemented bounded snippets/proof fields; live user flow not verified |
| Suggested fixes | migration planning/proposal code exists; verified templates are guarded and human-review-only, while unsupported findings remain review-only |
| Draft PRs | guarded implementation exists; no live GitHub write or Draft PR was authorized/executed |
| Notifications | Slack integration code/tests exist; delivery and account configuration unverified |
| Scan history | implemented database/API/dashboard path; staging data not verified |
| Workspaces | source and tenant predicates exist; multi-tenant production verification absent |
| Billing | plans/entitlements/webhooks exist in dirty working tree; provider account, enforcement, and production billing are unverified |

## 8. Security and beta readiness

Confirmed in source/tests: session checks, workspace/repository predicates, GitHub HMAC verification, Slack signature verification, CSRF checks on mutation routes, rate-limit helpers, secret redaction, baseline SHA checks, bounded source/proof persistence, idempotency, and fail-closed worker errors.

Unresolved: production secret/configuration evidence, GitHub App onboarding, real tenant-isolation exercise, production database migration/backup/restore rehearsal, worker observability and alerting, external billing enforcement, legal/consent completeness, and authenticated end-to-end runtime evidence. The product must not be described as secure, certified, compliant, or launch-ready from this source/test evidence alone.

## 9. Three demonstrated compatibility examples

1. **OpenAI GPT-4.5 Preview retirement** — Official source: `https://developers.openai.com/api/docs/deprecations`. Affected code: `client.chat.completions.create({ model: 'gpt-4.5-preview' })`; unaffected code: the same call with `model: 'gpt-4.1'`. Rule: `openai-gpt-4-5-preview-removal-2025-07-14`. Test paths: `tests/openai-gpt45-human-review.test.ts`, `tests/local-openai-production-promotion.test.ts`, and the provider validator. Expected/observed status: affected model → `AFFECTED`; replacement model → `NOT_AFFECTED`; dynamic model → `NEEDS_REVIEW`.
2. **Slack `files.upload` removal** — Official source: `https://api.slack.com/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay`. Affected code: `client.files.upload(...)`; unaffected code: a different Slack operation. Rule: `slack-files-upload-removal-2025-11-12`. Test path: `tests/slack-files-upload-human-review.test.ts`. The test evaluates the actual local production registry and checks the operation boundary and cross-provider isolation.
3. **Twilio Studio `/Engagements` deprecation** — Official source: `https://www.twilio.com/docs/studio/rest-api`. Affected code: a static request to `/Engagements`; unaffected code: `/Executions` or another endpoint. Rule: `twilio-studio-engagements-endpoint-deprecated`. Test paths: `tests/overnight-real-provider-candidates.test.ts` and the provider validator. Dynamic/unresolved endpoints are retained as `NEEDS_REVIEW`.

These are deterministic local fixtures, not proof of a live customer repository or provider API call.

## 10. Main provider workspace versus beta workspace

| Metric | Main provider workspace | Beta workspace |
|---|---:|---:|
| Reviewed/discovery providers | 19 active-rule providers / 153 discovery entries | 5 active-rule providers / 59 discovery entries |
| Registered production rules | 24 | 10 |
| Loadable reviewed rules | 50 across all 19 launch providers | current registry and `providers:validate:all` |
| Provider validation gates | 50 catalog checks plus 50 cross-provider isolation cases | `providers:validate:all`, `providers:validate:multi` |
| Official candidate records | 50, all review-bound | current candidate registry |
| Scan pipeline | local async productization, provider-change rescan, and worker paths tested; live execution unverified | release candidate evidence is historical |
| Typecheck | PASS | PASS in release candidate evidence |
| Lint | PASS in current workspace | PASS in release candidate evidence |
| Full tests | PASS: 148 files, 1,272 tests; 1 skipped file and 4 skipped tests | not rerun in release candidate |
| Launch readiness | not established | not established |

Nothing should be transferred from main to beta or vice versa without selecting a clean commit, reproducing registry counts, rerunning validators, and exercising authenticated onboarding and scan flow.

## 11. Historical capability scorecard

The scorecard below is retained as historical audit context from the earlier registry state. It is not the current launch decision; use `MY-OWL-BETA-READINESS-GAPS.md` and the latest `pnpm beta:readiness` output for current counts and gates.

- Production providers: 20 providers have active reviewed rules in the current main registry; 153 are discoverable/catalogued.
- Functioning providers: 15 providers are covered by the passing dedicated validator; only Stripe/Twilio are wired as legacy adapters in the synchronous scan service; no live end-to-end provider count is verified.
- Production compatibility rules: 25 registered in the current main working tree; 20 are covered by the dedicated validator.
- Rules verified by tests: 20 validator rules, plus focused rule tests; four Phase-F rules are registered but not in the dedicated validator.
- Discovery catalog: 153.
- Research candidates: 195 candidate records across 151 provider IDs; all `needs_review`.
- Supported languages: six constructed and productization-dispatched adapters (TypeScript/JavaScript, Python, Go, Java, Kotlin, and C#); Ruby/Rust are enum-only and not implemented adapters.
- Working detection categories: bounded static model, endpoint/resource, method/operation, parameter, auth/header, domain, response-field, and API-version rules.
- Automatic API change monitoring: not demonstrated; current evidence is manual/development-time ingestion.
- GitHub scanning status: local code path and worker tests exist; authenticated production end-to-end scanning is unverified.
- Beta workspace coverage: 59 discovery entries, 10 rules, 5 rule providers; not launch proof.
- Build/test health: typecheck pass; lint fails in current dirty workspace; full suite fails with 32 files and 38 tests because tests still assert a 20-rule registry while 25 rules load; build intentionally not run because it writes generated output.
- Critical launch blockers: dirty/non-reproducible workspaces, registry/test contract drift, missing live GitHub onboarding proof, no production scan proof, incomplete validator coverage for registered rules, generated-output lint failure, and unverified database/billing/operations configuration.
- Private Beta readiness: NOT READY / evidence incomplete.
- Public Beta readiness: NOT READY.
- V1 readiness: NOT READY.

## Reproducibility commands

```text
git -C C:\YC-provider-staging-integration-v2 status --short --branch
git -C C:\YC-provider-staging-integration-v2 rev-parse HEAD
pnpm exec tsx --conditions=apiproof-source -e "import { DISCOVERY_PROVIDERS, PRODUCTION_COMPATIBILITY_REGISTRY, OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './packages/providers/src/index.ts'; ..."
pnpm providers:validate:all
pnpm providers:validate:multi
pnpm typecheck
pnpm lint
pnpm test -- --reporter=dot
```

**MY OWL — HISTORICAL SNAPSHOT (RETAINED FOR TRACEABILITY)**

- Production providers: 20 active-rule providers.
- Functioning providers: 15 providers verified by the current provider validators.
- Production compatibility rules: 25 rules currently registered.
- Rules verified by tests: 20 rules covered by the dedicated validator suite.
- Discovery catalog: 153 provider entries.
- Research candidates: 195 candidate records across 151 providers.
- Supported languages: TypeScript, JavaScript, Python, Go, Java, Kotlin, C#, Ruby, and Rust are modeled; the first six are active in productization when repository evidence is present, while Ruby/Rust remain unimplemented adapters.
- Working detection categories: provider/package, operation/endpoint, parameter/model/resource/response-field, API-version, authentication, and domain compatibility checks, with fail-closed handling for dynamic or low-confidence evidence.
- Automatic API change monitoring: source/registry/candidate ingestion and duplicate/conflict guards exist; live external monitoring is not verified in this audit.
- GitHub scanning status: local authenticated/authorization and worker safeguards are implemented, but live GitHub onboarding and end-to-end repository scanning are not verified.
- Beta workspace coverage: the beta workspace has 59 discovery entries, 10 active production rules across 5 providers, and 10 candidate records, all currently `needs_review`.
- Build/test health: typecheck passes; lint fails on dirty generated output and one source max-lines violation; the full suite reports 32 failed files and 38 failed tests; build was not run because it writes generated output.
- Critical launch blockers: registry/test contract drift, five current rules outside the 20-rule validator coverage, lint failure, unverified live GitHub/App onboarding, and missing production evidence for deployment, billing, observability, and backup/restore.
- Private Beta readiness: NOT READY.
- Public Beta readiness: NOT READY.
- V1 readiness: NOT READY.

