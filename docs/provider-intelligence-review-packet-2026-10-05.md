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
| GitHub | `github-synchronous-sbom-endpoint-removal-2026-11-13` | [Synchronous SBOM deprecation](https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/) | endpoint removed | published 2026-05-12; removed 2026-11-13 | SDK/package/version |
| Twilio | `twilio-regional-api-domain-removal-2026-04-28` | [Regional domain deprecation](https://www.twilio.com/en-us/changelog/deprecation-of-region-specific-twilio-api-domain-patterns) | endpoint/domain removed | published 2026-02-04; removed 2026-04-28 | exact SDK constructor mapping |
| Twilio | `twilio-studio-engagements-endpoint-deprecated` | [Studio REST API](https://www.twilio.com/docs/studio/rest-api) | endpoint removed | no date stated | exact removal date and package/version |
| Supabase | `supabase-management-logs-all-removal-2026-09-23` | [Breaking changes](https://supabase.com/changelog?types=breaking-change) | endpoint removed | removed 2026-09-23 | exact canonical URL and package/version |
| Supabase | `supabase-openapi-anon-key-access-2026-03-11` | [OpenAPI anon-key change](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key) | authentication parameter required | effective 2026-03-11 | package/version and exact auth-header representation |

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
