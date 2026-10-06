# MY OWL real provider-change review packet

Status: candidate-only. Every record below is `needs_review`; none is in the production compatibility registry. All ten records now carry `sourceFingerprintBasis: full-body`, computed from a complete official HTTP response using the shared canonical URL + NUL + UTF-8 body algorithm. Multiple candidates may share one source fingerprint when they come from the same URL. The raw response bodies are not stored in this repository, so a human reviewer should re-fetch and compare each fingerprint before promotion.

## Review rules

Official source facts, MY OWL normalization, and unknown fields are kept separate. A reviewer must verify the source URL and fingerprint, confirm the normalized API scope, record a human identity, date, decision, and notes, and only then consider the separate production promotion gate. No candidate is automatically approved.

## Candidate inventory

| Provider | Candidate | Official source | Normalized change | Known dates | Unknowns |
|---|---|---|---|---|---|
| OpenAI | `openai-assistants-api-sunset-2026-08-26` | [Deprecations](https://developers.openai.com/api/docs/deprecations) | endpoint removed | published 2025-08-20; removed 2026-08-26 | SDK/package/version and exact operation mapping |
| OpenAI | `openai-gpt-4-5-preview-removal-2025-07-14` | [Deprecations](https://developers.openai.com/api/docs/deprecations) | model retired | published 2025-04-14; removed 2025-07-14 | SDK/package/version |
| Anthropic | `anthropic-claude-opus-4-1-retirement-2026-08-05` | [Model deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations) | model retired | deprecated 2026-06-05; retired 2026-08-05 | SDK/package/version |
| Anthropic | `anthropic-opus-4-7-parameter-restrictions` | [Model deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations) | parameter removed/rejected | no date stated | SDK/package/version and exact request-shape mapping |
| GitHub | `github-organization-security-fields-removed-2026-04-21` | [Security field deprecation](https://github.blog/changelog/2026-03-24-upcoming-deprecation-of-security-related-organization-api-fields/) | response fields removed | published 2026-03-24; removed 2026-04-21 | SDK/package/version |
| GitHub | `github-synchronous-sbom-endpoint-removal-2026-11-13` | [Synchronous SBOM deprecation](https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/) | provider + endpoint removed | published 2026-05-12; removed 2026-11-13 | SDK/package/version, GraphQL, API version |
| Twilio | `twilio-regional-api-domain-removal-2026-04-28` | [Regional domain deprecation](https://www.twilio.com/en-us/changelog/deprecation-of-region-specific-twilio-api-domain-patterns) | provider + domain removed | published 2026-02-04; removed 2026-04-28 | SDK package/version and constructor mapping |
| Twilio | `twilio-studio-engagements-endpoint-deprecated` | [Studio REST API](https://www.twilio.com/docs/studio/rest-api) | provider + endpoint removed | no current removal date stated | SDK package/version and exact removal date |
| Supabase | `supabase-management-logs-all-removal-2026-09-23` | [logs.all migration](https://supabase.com/changelog/48235-migration-of-supabase-management-api-logs-all-analytics-endpoint-to-logs-endpoint) | provider + endpoint removed | published 2026-07-23; removed 2026-09-23 | package/version |
| Supabase | `supabase-openapi-anon-key-access-2026-03-11` | [OpenAPI anon-key change](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key) | provider + endpoint + auth/header restriction | published 2026-02-17; rollout began 2026-03-11 | package/version and literal header representation |

## Overnight refresh fingerprints

These records remain `needs_review` and are not in the production registry.

| Candidate | Document fingerprint | Evidence fingerprint | Candidate fingerprint |
|---|---|---|---|
| `github-synchronous-sbom-endpoint-removal-2026-11-13` | `f509f8d68a1bd919c655c0d367a998f233829c53a5c4e7431cd9b45bea1d16f0` | `4fa080a36ae032f8b589028bbc74233d8aa43a6a1625bc2037d85f9b1cd5f81f` | `d88ec47a8f030ce6f4e318c70ddc6880ee310ac8c6c107ee8e5af06c94680bec` |
| `twilio-regional-api-domain-removal-2026-04-28` | `c21edcc6438491332e641f4f6706ce98830d191009c326555af7bc728d7719ed` | `d6219d4929018c959dbd916b38773325cc8ce3a709f7ddb8d68dc5a3e838e3d6` | `6646a65d4ac5bd2ed3f549013766ed95beedd5bfc4c7b5c78ab0c4a117bb0143` |
| `twilio-studio-engagements-endpoint-deprecated` | `659fda69acef4282bcce9ff6046fedcc76473e307eedd2fef6fbbcb0314713b3` | `0501efa9e9427c234e8450893c1208645f90f7fa35a6475635fb9a9196835ad6` | `699aabd98ad389d1ff0a39b8a4bfac0df78dbaf544850c96697dd88cf7abc1e7` |
| `supabase-management-logs-all-removal-2026-09-23` | `1cd6ddf38800302ff4df662b1dc5cab8dd171a848647ad223150efc0a2fc29c8` | `b6f56792e51270c86280e4a8b5e619d1f871b9dc91ea0cd86379c971a2de9f23` | `39f2f68655b0713137fe5ce81101af481fd2914c78c698752e042e88466fbd4e` |
| `supabase-openapi-anon-key-access-2026-03-11` | `f8cc1c82fdef5b686930280bd95860dc7413c45a5e6d1db8edf2744a8c110f96` | `e162ea328b8db825a739fce6174efaa03637d86ef408ea81a173988886b7ff6c` | `33b4ebe9cdfef34571301ccfb2cd4e764fd0fe28564260c5066a8661dec2cfa5` |

## Normalization and machine-testability

The candidate source facts are machine-testable through model, endpoint, response-field, parameter, and static/dynamic evidence in the normalized usage IR. Package and version are deliberately unknown where the source does not state them. The test-only benchmark supplies a reviewed projection for five representative mappings; that projection is not a production record.

Each candidate has affected, unaffected, and uncertain fixture intent. The affected case requires exact static evidence; the unaffected case requires complete evidence showing the changed element is unused; the uncertain case uses dynamic or low-confidence evidence and must remain `NEEDS_REVIEW`.

Proposed severity is `high` only for records whose official text states removal,
hard failure, HTTP 400 behavior, or an equivalent access restriction. Records
without that explicit impact basis leave severity unknown until human review.

Package/version evidence is unknown for these candidates unless the official
source explicitly supplies it. The benchmark’s package names and reviewed
projections are test-only mappings used to exercise the generic engine.

## Exact human action

For each candidate, inspect the linked official source, recapture the complete source body and fingerprint, verify every proposed API element, supply any supported SDK/package and version scope, set severity, and record an explicit local review action. Only after that candidate reaches `reviewed` may a human separately invoke the existing promotion gate. Rejection leaves it outside production.

## Not inferred

No candidate invents a semver range. No candidate asserts that an SDK package is affected when the official source only names an API, model, endpoint, or parameter. No candidate is a production compatibility claim, migration, deployment, or automatic approval.
