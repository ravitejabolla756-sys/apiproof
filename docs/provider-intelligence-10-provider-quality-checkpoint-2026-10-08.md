# MY OWL Provider Intelligence — 10-Provider Quality Checkpoint

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Checkpoint: `67d2aa3`

## Registry integrity — PASS

The local reviewed registry contains 15 unique, deterministically ordered records across 10 providers. Every record is `reviewed`, has `official` provenance, valid applicability dimensions, and review fingerprint bindings. Expansion candidates remain outside the reviewed registry unless explicitly reviewed.

Reviewed rules:

1. `openai-gpt-4-5-preview-removal-2025-07-14`
2. `openai-assistants-api-sunset-2026-08-26`
3. `anthropic-claude-opus-4-1-retirement-2026-08-05`
4. `anthropic-opus-4-7-parameter-restrictions`
5. `github-organization-security-fields-removed-2026-04-21`
6. `github-synchronous-sbom-endpoint-removal-2026-11-13`
7. `twilio-regional-api-domain-removal-2026-04-28`
8. `twilio-studio-engagements-endpoint-deprecated`
9. `supabase-management-logs-all-removal-2026-09-23`
10. `supabase-openapi-anon-key-access-2026-03-11`
11. `slack-files-upload-removal-2025-11-12`
12. `shopify-checkout-api-shutdown-2025-04-01`
13. `launchdarkly-api-version-20220603-eol-2025-04-15`
14. `aws-cloudwatch-evidently-end-of-support-2025-10-16`
15. `cloudflare-service-key-auth-removal-2026-09-30`

Counts: OpenAI 2, Anthropic 2, GitHub 2, Twilio 2, Supabase 2, Slack 1, Shopify 1, LaunchDarkly 1, AWS 1, Cloudflare 1.

## Compatibility matrix — PASS for reviewed semantics

Each rule has an exact affected condition, a complete non-match condition, and an incomplete/dynamic condition. The generic evaluator uses the following deterministic result model:

| Rule family | AFFECTED | NOT_AFFECTED | NEEDS_REVIEW |
|---|---|---|---|
| OpenAI model retirement | exact `gpt-4.5-preview` | `gpt-4.1`/other static model | unresolved model |
| OpenAI resource sunset | exact Assistants API | Responses/Conversations/other static resource | unresolved resource |
| Anthropic model retirement | exact Opus 4.1 identifier | replacement/other static model | unresolved model |
| Anthropic parameter restriction | affected model + disallowed value | absent/allowed value | dynamic value/model |
| GitHub response fields | exact removed organization field | unaffected field | dynamic property |
| GitHub SBOM endpoint | exact synchronous endpoint | replacement/other endpoint | unresolved endpoint |
| Twilio regional domains | exact deprecated hostname | canonical/unrelated hostname | unresolved hostname |
| Twilio Engagements | exact `/Engagements` operation | `/Executions`/other operation | unresolved operation |
| Supabase `logs.all` | exact endpoint | `logs`/other endpoint | unresolved endpoint |
| Supabase anon-key restriction | `/rest/v1/` + anon credential class | allowed credential or outside scope | unknown credential/endpoint |
| Slack `files.upload` | exact operation | replacement/other operation | unresolved operation |
| Shopify Checkout shutdown | exact affected resource | Cart API/other resource | unresolved resource |
| LaunchDarkly API version | exact `20220603` | complete different version | dynamic/missing version |
| AWS Evidently | exact CloudWatch Evidently resource | other AWS resource | unresolved resource |
| Cloudflare Service Key | exact `X-Auth-User-Service-Key` | API Token/other auth | unresolved auth evidence |

Reason codes preserve whether the result came from a static match, a complete non-match, or insufficient evidence. Duplicate usage identities are reduced deterministically.

## Cross-provider isolation — PASS

The reviewed-registry and normalized-compatibility tests confirm provider identity is required. OpenAI evidence does not trigger Anthropic; AWS does not trigger Cloudflare; LaunchDarkly versions do not affect other providers; Shopify resources do not trigger Slack; GitHub fields, Twilio domains, and Supabase endpoint/auth conditions remain provider-scoped.

## Analyzer coverage

| Provider/rule evidence | TypeScript/JavaScript | Python |
|---|---|---|
| OpenAI, Anthropic, GitHub, Twilio, Supabase, Slack, Shopify, LaunchDarkly, AWS, Cloudflare normalized conditions | NORMALIZED_IR_ONLY | NORMALIZED_IR_ONLY |
| TypeScript static imports/SDK calls, HTTP domains, headers, API versions | PARTIAL to FULL depending on evidence kind | NORMALIZED_IR_ONLY |
| Dynamic values and wrapper/resource uncertainty | PARTIAL, fail-closed | NORMALIZED_IR_ONLY |

This checkpoint does not claim Python parser coverage that was not executed. Language-neutral TypeScript/Python normalized-IR equivalence is covered.

## Productization and privacy — PASS/PARTIAL

Existing productization tests pass with deterministic registry evaluation and assert `externalAiRequired=false`, `rawSourceExternalTransmission=false`, and deterministic reviewed-registry authority. Existing performance fixtures cover small, medium, and large TypeScript scans; mixed-language and 10-provider end-to-end runtime coverage remains normalized/test-contract coverage rather than a production-scale claim.

Fake secret-like values are redacted or omitted from normalized header evidence and compatibility output. Environment-variable names may remain. No token decoding or secret inference is performed.

## Proof, API, and dashboard — PASS

Compatibility Proof and Compatibility Map contracts preserve provider, change ID, status, severity, dates, replacement metadata, review status, official provenance, reason codes, and static source locations where available. Discovery/candidate/reviewed counts remain distinct; the reviewed surface reports 10 providers and 15 rules. Rendering is generic across model, resource, endpoint, operation, parameter, response-field, domain, auth/header, and API-version scopes. No provider-specific UI branch was added.

Failed scans remain distinct from successful clean scans in the existing productization/API contracts.

## Deduplication and conflicts — PASS

Repeated usage IDs, repeated rule evidence, multiple affected usages, same-provider multiple rules, static/dynamic evidence, and partial evidence are covered by the compatibility and normalized-IR suites. Results and registry order are deterministic.

## Performance — PASS for local fixture measurement only

Existing productization performance harness, using the actual 15-rule local registry, reported:

| Fixture | Files | Discovery ms | Analysis ms | Compatibility ms | Proof ms | Total ms |
|---|---:|---:|---:|---:|---:|---:|
| small | 4 | 15 | 41 | 57 | 3 | 117 |
| medium | 21 | 8 | 31 | 1 | 1 | 41 |
| large | 81 | 15 | 73 | 2 | 2 | 92 |

These are local in-memory fixture timings and are not production-scale capacity claims.

## Expansion benchmark — PASS

The existing expansion benchmark executed 1 case for each verified expansion candidate. It passed with no status mismatches. The separate 15-rule internal benchmark executed 35 cases: 14 AFFECTED, 14 NOT_AFFECTED, and 7 NEEDS_REVIEW, all passing.

## Validation results

- Focused provider-intelligence suites: passed; 135 tests in the checkpoint batch.
- Shared/core/providers/analyzers/web/CLI typechecks: passed.
- Lint: passed.
- `git diff --check`: passed.
- Full suite: 1,111 passed, 4 skipped, 49 failed.

The full-suite failures are the known unrelated `FIXTURE_DIGEST_MISMATCH` patching/patch-CLI failures, plus the pre-existing evaluation-corpus digest mismatch. No provider-intelligence failure remained after the Cloudflare insertion checkpoint.

## Gate summary

| Gate | Result |
|---|---|
| Registry integrity | PASS |
| Review provenance | PASS |
| Compatibility semantics | PASS |
| Cross-provider isolation | PASS |
| TypeScript coverage | PARTIAL |
| Python coverage | NORMALIZED_IR_ONLY |
| Productization | PASS |
| Privacy/secret safety | PASS |
| Proof quality | PASS |
| API consistency | PASS |
| Dashboard contracts | PASS |
| Deduplication/conflicts | PASS |
| Performance | PASS (local fixtures only) |
| Expansion benchmark | PASS |
| Typechecks/lint/diff | PASS |
| Full suite | PARTIAL (unrelated baseline failures) |

No generic defect was proven, no provider-specific workaround was added, and no provider #11 was added.

Recommendation: `READY_TO_CONTINUE_PROVIDER_EXPANSION`
