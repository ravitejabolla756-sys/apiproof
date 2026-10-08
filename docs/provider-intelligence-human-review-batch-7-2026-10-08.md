# Provider Intelligence Human Review Batch 7

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Status: preparation only; no candidate was reviewed, promoted, or inserted into the production registry.

## Baseline safety check

The local reviewed registry remains 15 rules across 10 providers:

| Provider | Reviewed rules |
|---|---:|
| OpenAI | 2 |
| Anthropic | 2 |
| GitHub | 2 |
| Twilio | 2 |
| Supabase | 2 |
| Slack | 1 |
| Shopify | 1 |
| LaunchDarkly | 1 |
| AWS | 1 |
| Cloudflare | 1 |

No Batch 7 candidate has reviewer metadata or reviewed state.

## Selection method

Candidates were ranked by: first-party source specificity, objective machine-testable identity, completeness of applicability scope, explicit effective/removal fact, deterministic analyzer coverage, and migration guidance. Candidates without sufficiently specific first-party evidence were not selected.

| Rank | Provider / candidate | Assessment |
|---:|---|---|
| 1 | ElevenLabs — `elevenlabs-v1-model-removal-2026-07-09` | Exact model IDs, removal date, replacements, provider+model scope; ready for human review preparation |
| 2 | Clerk — `clerk-api-2026-05-12-metadata-fields-removed` | Exact endpoints and parameters, API-version/effective date, dedicated metadata replacement; ready for preparation |
| 3 | Groq — `groq-models-decommissioned-2026-09-21` | Exact model IDs and decommission date; no replacement asserted; ready for preparation |
| 4 | Firebase — `firebase-instance-id-server-apis-decommission-2027-09-29` | Exact official endpoint and decommission date; official migration guidance; ready for preparation |
| 5 | Google Cloud — `google-cloud-api-registry-mcp-shutdown-2026-07-30` | Exact resource and shutdown date, Agent Registry replacement; ready for preparation |
| 6 | Okta — `okta-risk-provider-and-events-api-deprecation` | Specific resources and replacements, but no effective/removal date in the captured evidence |
| 7 | MongoDB — `mongodb-atlas-m2-m5-serverless-eol-2026-01-22` | Specific resource/date/replacement; requires later source refresh and scope review |
| 8 | Databricks — `databricks-sql-legacy-api-deprecation-2026` | Resource/replacement evidence, but no explicit removal date in the captured record |
| 9 | Snowflake — `snowflake-sql-api-old-functionality-disabled-future` | Requires current official source revalidation |
| 10 | Vercel — `vercel-legacy-integration-webhook-endpoints-removal-2021-08-20` | Specific historical candidate; requires current-source revalidation |
| 11 | Datadog — `datadog-api-catalog-update-endpoint-deprecated` | Endpoint identity is present; removal applicability requires source review |
| 12 | New Relic — `new-relic-rest-api-v1-superseded-by-v2` | Version migration candidate; exact removal applicability requires source review |
| 13 | Microsoft Azure — `microsoft-azure-api-version-retirement-pre-2021-08-01-2024-06-01` | API-version candidate; requires source refresh |
| 14 | Square — `square-customer-cards-field-retired-2025-01-23` | Response-field candidate; requires source refresh |
| 15 | Discord — `discord-social-sdk-default-scopes-removal-2025-03-26` | Scope/permission candidate; requires source refresh |
| 16 | Atlassian — `atlassian-admin-v1-users-groups-api-removal-2027-06-30` | Endpoint candidate; requires source refresh |
| 17 | Auth0 — `auth0-enabled-clients-field-deprecation-2026-07-13` | Field candidate; requires source refresh |
| 18 | Linear — `linear-mcp-sse-endpoint-removal-2026` | Endpoint candidate; requires source refresh |
| 19 | Cohere — `cohere-embed-v2-model-retirement-2026-04-04` | Model candidate; requires source refresh |
| 20 | Mistral — `mistral-ocr-4-0-model-retirement-2026-09-30` | Model candidate; requires source refresh |
| 21 | Neon — `neon-api-reference-site-retirement` | Resource identity is not yet sufficient for a reviewed compatibility claim |
| 22 | Elasticsearch — `elasticsearch-monitoring-plugin-removal-10` | Resource candidate; requires source refresh |
| 23 | Algolia — `algolia-update-task-v1-deprecation` | Operation candidate; requires source refresh |
| 24 | GitLab — `gitlab-subscription-api-endpoints-removal` | `NEEDS_MORE_SOURCE_REVIEW`; not selected |
| 25 | Deepgram — `deepgram-legacy-intelligence-parameters-2025-11-05` | Blocked by incomplete applicability; not selected |

The remaining lower-confidence catalog records (PayPal, Netlify, Sentry, Segment, Adyen, Paddle, WorkOS) are intentionally retained as review candidates and were not selected because their captured evidence is explicitly incomplete.

## First-party source revalidation

### 1. ElevenLabs

Official source: [June 8, 2026 changelog](https://elevenlabs.io/docs/changelog/2026/6/8)

Proven facts: `eleven_monolingual_v1`, `eleven_multilingual_v1`, and `scribe_v1` are removed on 2026-07-09. The source names `eleven_multilingual_v2`, `scribe_v2`, and `scribe_v2_realtime` as migration targets. No SDK package/version or method scope is asserted.

Stored document fingerprint: `c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a`
Evidence fingerprint: `5ad9764c8d1c42c47c315e6075cc1f6b4fbcc311cb6ae122046014a17ded5667`
Recomputed candidate fingerprint: `7c8612724d51d9238f0abe1b0e79da053031435986dfba24c5433813201f6a9d`
Source state: `SOURCE_UNCHANGED` for the candidate-specific facts.
Scope: `provider + model`. Severity: `high`, based only on documented model removal.
Coverage: TypeScript/Python normalized model evidence supported; dynamic model remains unresolved.

### 2. Clerk

Official source: [API version 2026-05-12 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/2026-05-12)

Proven facts: `public_metadata`, `private_metadata`, and `unsafe_metadata` are removed from the documented general-purpose update endpoints at API version 2026-05-12; dedicated metadata endpoints are the replacement. The affected endpoints are `/v1/users/{user_id}`, `/v1/organizations/{organization_id}`, and `/v1/me`. No SDK package/version claim is made.

Stored document fingerprint: `cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a`
Evidence fingerprint: `9c095e2e61e9d21a20a4f113c57d68a7b55e99819279765c49c1fdbfab856149`
Recomputed candidate fingerprint: `34cbb038ef08d8663c4bf3118f4fb74fa987d44c6e182e124e45f4185813c4ba`
Source state: `SOURCE_UNCHANGED` for the candidate-specific facts.
Scope: `provider + endpoint + parameter`. Severity: `high`, based only on documented parameter removal.
Coverage: generic endpoint/parameter IR supports static proof; dynamic endpoint or parameter is `NEEDS_REVIEW`.

### 3. Groq

Official source: [Groq model deprecations](https://console.groq.com/docs/deprecations)

Proven facts: `groq/compound` and `groq/compound-mini` were decommissioned on 2026-09-21 and requests return errors. No replacement is documented in the source and none is asserted.

Stored document fingerprint: `6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07`
Evidence fingerprint: `ac3a75f4b550484539e211ead2529b8a3198160f0c8b82cbf7547d024e265b2b`
Recomputed candidate fingerprint: `f524737bff543b5fdbb81b61d4767186b0d1a853828c4d791ca7f78526d13587`
Source state: `SOURCE_UNCHANGED` for the candidate-specific facts.
Scope: `provider + model`. Severity: `high`, based only on documented decommissioning.
Coverage: TypeScript/Python model evidence supported; dynamic model is `NEEDS_REVIEW`.

### 4. Firebase

Official source: [Firebase Cloud Messaging troubleshooting and FAQ](https://firebase.google.com/docs/cloud-messaging/troubleshooting)

Proven facts: requests to `https://iid.googleapis.com/iid/info` begin failing after 2027-09-29 as part of the Instance ID server API decommissioning. The source documents FCM v1 `validate_only=true` for token validation and a topic subscription API for topic operations. No SDK package/version scope is asserted.

Stored document fingerprint: `f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65`
Evidence fingerprint: `29b85940142f39c5a0c91304295ea7d18090d2ead4eaf1c011e2ea6beb2a4ab4`
Recomputed candidate fingerprint: `e2ed8f337cb795df1b61c6b8e13ef6a4ff45c5124295a34c6cc7cbbecdf116d0`
Source state: `SOURCE_UNCHANGED` for the candidate-specific facts.
Scope: `provider + endpoint`. Severity: `high`, based only on documented API decommissioning.
Coverage: generic hostname/endpoint IR supports static proof; dynamic endpoint is `NEEDS_REVIEW`.

### 5. Google Cloud

Official sources: [Cloud API Registry release notes](https://docs.cloud.google.com/api-registry/release-notes) and [deprecations](https://docs.cloud.google.com/api-registry/docs/deprecations)

Proven facts: Cloud API Registry support for retrieving, listing, enabling, and disabling MCP servers and tools shuts down on 2026-07-30. The deprecation documentation identifies Agent Registry as the replacement catalog. No SDK package/version or endpoint-specific scope is asserted.

Stored document fingerprint: `e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917`
Evidence fingerprint: `7c2b692277ed354aefda6100fcd9796c7c3534010450bce5c6269457c8a5cec4`
Recomputed candidate fingerprint: `ece56605780bdbce9771ba7af275a81a1018a51e4645fb8724dc883280dfa3d4`
Source state: `SOURCE_UNCHANGED` for the candidate-specific facts.
Scope: `provider + resource`. Severity: `high`, based only on documented shutdown.
Coverage: generic resource IR supports static proof; dynamic resource is `NEEDS_REVIEW`.

## Test-only projection expectations

No projection was persisted and no review function was executed. The deterministic compatibility expectations for the selected candidates are:

| Candidate | Static affected usage | Replacement/unrelated usage | Dynamic usage | Wrong provider |
|---|---|---|---|---|
| ElevenLabs | each of the three retired model IDs → `AFFECTED` | v2/current model → `NOT_AFFECTED` | `NEEDS_REVIEW` | no ElevenLabs claim |
| Clerk | affected endpoint + removed metadata parameter → `AFFECTED` | dedicated metadata endpoint/unrelated parameter → `NOT_AFFECTED` | `NEEDS_REVIEW` | no Clerk claim |
| Groq | either Compound model → `AFFECTED` | unrelated model → `NOT_AFFECTED` | `NEEDS_REVIEW` | no Groq claim |
| Firebase | exact `iid.googleapis.com/iid/info` endpoint → `AFFECTED` | unrelated endpoint → `NOT_AFFECTED` | `NEEDS_REVIEW` | no Firebase claim |
| Google Cloud | API Registry MCP server/tool resource → `AFFECTED` | Agent Registry/unrelated resource → `NOT_AFFECTED` | `NEEDS_REVIEW` | no Google Cloud claim |

Equivalent duplicate evidence must produce one usage identity/finding. Lookalike endpoints/resources and cross-provider identifiers must not match. These are test-only expectations; none are production compatibility claims.

## Promotion-gate dry run

All five candidates have `state=needs_review`, official provenance, non-empty applicability scopes, candidate-specific evidence fingerprints, and generic high severity justified by explicit removal/decommission/shutdown facts. They are structurally eligible for the existing post-review promotion gate. No `reviewCandidate()` or `promoteCandidateToReviewed()` call was executed, no reviewer metadata was added, and no production registry record was created.

The exact review action for each candidate must be generated only after Ravi reviews the current facts and confirms the current fingerprints. The required action shape is the existing strict review input with `decision=approve-for-promotion-review`, `reviewer`, `reviewedAt`, exact notes, current source/document fingerprint, current evidence fingerprint, and current candidate fingerprint.

## Safety and architecture result

No analyzer or compatibility-engine change is required for this batch. Existing generic model, endpoint, resource, and parameter IR is sufficient. No provider-specific analyzer branch is proposed. Secret headers/tokens remain outside evidence and are not persisted by this preparation.

Final status for all five: `READY_FOR_HUMAN_APPROVAL` (preparation only). They remain `needs_review` and must not be promoted without explicit human decisions.
