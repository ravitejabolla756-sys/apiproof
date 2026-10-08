# Provider Intelligence Expansion Review Packet

Status: historical baseline packet. See human-review batches 1–6 for the current
fingerprints, candidate IDs, readiness, and local reviewed-registry state. No
unapproved candidate is production-enabled.

## Baseline

| Measure | Count | Source |
| --- | ---: | --- |
| Discovery providers | 59 | `packages/providers/src/discovery-registry.ts` |
| Candidate rules | 10 | `packages/providers/src/official-change-candidates.ts` |
| Candidate providers | 5 | distinct `providerId` values |
| Reviewed production providers | 5 | OpenAI, Anthropic, GitHub, Twilio, Supabase |
| Reviewed production rules | 10 | local reviewed production registry |

The reviewed production registry is frozen for this batch.

## Research policy

An accepted candidate requires all of the following:

- first-party source URL;
- deterministic extracted evidence;
- reproducible full-document fingerprint using `fingerprintOfficialSource`;
- evidence fingerprint;
- candidate fingerprint;
- `state = needs_review`;
- no invented SDK, package, version, endpoint, model alias, date, or replacement facts.

The shell environment currently cannot reach external HTTPS sources. Search results and rendered snippets are therefore treated as discovery leads only. They are not promoted into the canonical candidate registry and do not receive fabricated fingerprints.

## Research leads blocked pending complete source snapshots

### Slack

- Candidate lead: Web API `files.upload` retirement.
- Official source: https://api.slack.com/changelog/future
- Officially observed facts: the `files.upload` Web API method is deprecated and scheduled to retire on March 11, 2025; Slack directs integrations to its asynchronous upload flow.
- Proposed scope: `provider + operation`.
- Proposed type: `method_removed`.
- Confidence: medium until a complete source snapshot is captured.
- State: `SOURCE_UNAVAILABLE_REVIEW_REQUIRED`.
- Unknown: package/version applicability and exact SDK operation mapping.

### Shopify

- Candidate lead: deprecated Checkout APIs shutdown.
- Official source: https://shopify.dev/changelog/release-notes/2025-04
- Officially observed facts: deprecated Checkout APIs, including Storefront Checkout mutations and REST Checkout endpoints, shut down on April 1, 2025; Shopify directs apps to the Storefront Cart API and mobile apps to Checkout Sheet Kit.
- Proposed scope: `provider + resource` pending exact operation identifiers.
- Proposed type: `endpoint_removed`.
- Confidence: medium until the specific changelog entry is captured as a complete source snapshot and the exact affected identifiers are normalized.
- State: `SOURCE_UNAVAILABLE_REVIEW_REQUIRED`.
- Unknown: exact endpoint/mutation set, package/version applicability, and whether one or multiple candidate records are warranted.

## Pool triage

The following providers remain in the research pool and have not been accepted as candidates in this checkpoint because a complete, reproducible official source snapshot has not yet been captured:

PayPal, Square, Adyen, Plaid, Braintree, AWS, Microsoft Azure, Google Cloud, Cloudflare, Vercel, Netlify, Shopify, Atlassian, GitLab, Slack, Discord, Notion, Linear, PagerDuty, Auth0, Okta, Clerk, Firebase, MongoDB Atlas, Elastic, Algolia, Neon, PlanetScale, Snowflake, Databricks, Pinecone, Weaviate, Qdrant, Mistral AI, Cohere, Groq, Together AI, Perplexity, Hugging Face, Replicate, ElevenLabs, Deepgram, AssemblyAI, SendGrid, Mailgun, Postmark, Resend, Sentry, Datadog, New Relic, LaunchDarkly, Segment.

This is a research ledger, not a claim that these providers have no qualifying changes.

## Safety invariants

- No new provider has been added to the reviewed production registry.
- No human review has been fabricated.
- No source body has been persisted.
- No staging or production infrastructure was contacted.
- No Vercel, Supabase, GitHub, credential, deployment, or push action was performed.

## Next evidence gate

Resume with an official-source adapter or network-capable capture environment. For each lead, capture the exact response body, calculate the full-document fingerprint, deterministically extract the candidate evidence, calculate the evidence and candidate fingerprints, then add only validated `needs_review` candidates to modular provider candidate files.

## Captured first expansion batch

The isolated branch now contains four additional `needs_review` candidates. Their fingerprints use the shared canonical URL plus exact UTF-8 response-body algorithm; no source body is persisted.

| Provider | Candidate | Official source | Scope | Document fingerprint |
|---|---|---|---|---|
| Slack | `slack-files-upload-removal-2025-03-11` | https://api.slack.com/changelog/future | provider + operation | `cd5d486008d300e2b18577f857dd198b13a8c10fed4535934840d8a46a8dc072` |
| Shopify | `shopify-checkout-api-shutdown-2025-04-01` | https://shopify.dev/changelog/release-notes/2025-04 | provider + resource | `4dd48840b2ea1f48d347552f70264c5d4de8e71e2f66c6c0452b9bd05461895a` |
| Cloudflare | `cloudflare-workers-kv-legacy-routes-2026-10-15` | https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/ | provider + endpoint | `dc35e40086373f1b0e32d733c378a486380b3681a05a689cdf92331625a1407b` |
| Microsoft Azure | `microsoft-azure-api-version-retirement-pre-2021-08-01-2024-06-01` | https://learn.microsoft.com/en-us/azure/api-management/breaking-changes/api-version-retirement-sep-2023 | provider + api_version | `3734c416514ca16ea38480f965d258157271540af2aab0759a63b1ca717ce441` |

The source-derived evidence and candidate fingerprints are computed by the repository at load time. None of these candidates is reviewed or included in the production compatibility registry.

## Current isolated checkpoint status (2026-10-08)

The isolated branch now contains 31 verified expansion candidates spanning 30 distinct new providers. Every expansion candidate is explicitly `needs_review`; the reviewed production registry remains unchanged at 10 rules across OpenAI, Anthropic, GitHub, Twilio, and Supabase. The expansion registry contains 41 candidates in total (10 historical candidates plus 31 expansion candidates).

The current batch includes exact canonical full-body fingerprints for the fetched first-party pages. Candidate-specific evidence and candidate fingerprints are derived deterministically at load time by the existing registry implementation; source bodies are not persisted. Records with incomplete applicability facts remain needs-review and include explicit unknowns rather than inferred SDK/package/version scope.

| Metric | Result | Safety interpretation |
| --- | ---: | --- |
| New candidate records | 31 | All `needs_review` |
| Distinct new providers | 30 | Cloudflare has two independently sourced candidates |
| Total candidate records | 41 | Historical 10 + expansion 31 |
| Reviewed production rules | 10 | Unchanged; no expansion candidate is production-enabled |
| Providers with discovery metadata | 59+ | Discovery metadata remains separate from change candidates |

## Candidate coverage and review gate

Each expansion record carries a provider, source URL, full-body document fingerprint, deterministic evidence fingerprint, candidate fingerprint, source type, audit trail, applicability dimensions, severity basis, and explicit unknowns where applicable. The coverage gate checks:

- candidate identity uniqueness;
- distinct-provider target (30);
- 64-character document/evidence/candidate fingerprints;
- `needs_review` state for every expansion record;
- non-empty applicability scope;
- production registry count and rule identity unchanged;
- no reviewer or promotion metadata on expansion records.

The benchmark was executed as 3 deterministic outcomes per expansion candidate
(31 each of affected, not affected, and needs review) plus the existing 35
reviewed-rule cases: 128 total scenario slots. These remain test-only
projections; they do not alter the production registry.

## Sources requiring manual review before any promotion

Seven source leads were intentionally excluded from the canonical candidate registry because their captured pages did not establish a concrete compatibility change: PayPal, Netlify, Sentry, Segment, Adyen, Paddle, and WorkOS. They remain in the research ledger only and must receive a later deterministic source extraction before they can be considered. No candidate in this packet is safe to promote automatically.

## Complete expansion candidate index

The source registry is authoritative for each candidate's exact target,
replacement, unknowns, audit trail, and document/evidence/candidate
fingerprints. The complete index is generated below so every expansion record
is visible to human review.

| Provider | Candidate | Official source | Change type | Applicability | Severity | Analyzer coverage | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | `slack-files-upload-removal-2025-03-11` | https://api.slack.com/changelog/future | method_removed | provider + operation | high | TS/JS IR benchmark | needs_review |
| okta | `okta-risk-provider-and-events-api-deprecation` | https://developer.okta.com/docs/release-notes/2025-okta-identity-engine/ | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| elevenlabs | `elevenlabs-v1-model-removal-2026-07-09` | https://elevenlabs.io/docs/changelog/2026/6/8 | model_retired | provider + model | high | TS/JS IR benchmark | needs_review |
| cloudflare | `cloudflare-service-key-auth-removal-2026-09-30` | https://developers.cloudflare.com/fundamentals/api/reference/deprecations/ | endpoint_removed | provider + auth_or_header | high | TS/JS IR benchmark | needs_review |
| clerk | `clerk-api-2026-05-12-metadata-fields-removed` | https://clerk.com/docs/guides/development/upgrading/upgrade-guides/2026-05-12 | parameter_removed | provider + endpoint + parameter | high | TS/JS IR benchmark | needs_review |
| groq | `groq-models-decommissioned-2026-09-21` | https://console.groq.com/docs/deprecations | model_retired | provider + model | high | TS/JS IR benchmark | needs_review |
| firebase | `firebase-instance-id-server-apis-decommission-2027-09-29` | https://firebase.google.com/docs/cloud-messaging/troubleshooting | endpoint_removed | provider + endpoint | high | TS/JS IR benchmark | needs_review |
| google-cloud | `google-cloud-api-registry-mcp-shutdown-2026-07-30` | https://docs.cloud.google.com/api-registry/release-notes | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| mongodb | `mongodb-atlas-m2-m5-serverless-eol-2026-01-22` | https://www.mongodb.com/docs/atlas/flex-migration/ | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| databricks | `databricks-sql-legacy-api-deprecation-2026` | https://docs.databricks.com/aws/en/sql/dbsql-api-latest | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| snowflake | `snowflake-sql-api-old-functionality-disabled-future` | https://docs.snowflake.com/en/developer-guide/sql-api/sql-api-old | endpoint_removed | provider + endpoint | high | TS/JS IR benchmark | needs_review |
| launchdarkly | `launchdarkly-api-versions-retirement-2026-12-31` | https://launchdarkly.com/docs/api/ | api_version_retired | provider + api_version | high | TS/JS IR benchmark | needs_review |
| vercel | `vercel-legacy-integration-webhook-endpoints-removal-2021-08-20` | https://vercel.com/changelog/sunsetting-ui-hooks-and-legacy-webhooks | endpoint_removed | provider + endpoint | high | TS/JS IR benchmark | needs_review |
| datadog | `datadog-api-catalog-update-endpoint-deprecated` | https://docs.datadoghq.com/api/latest/api-management/update-an-api/ | endpoint_removed | provider + endpoint | medium | TS/JS IR benchmark | needs_review |
| new-relic | `new-relic-rest-api-v1-superseded-by-v2` | https://docs.newrelic.com/docs/apis/rest-api-v2/api-explorer-v2/introduction-new-relics-rest-api-explorer/ | api_version_retired | provider + api_version | high | TS/JS IR benchmark | needs_review |
| shopify | `shopify-checkout-api-shutdown-2025-04-01` | https://shopify.dev/changelog/release-notes/2025-04 | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| cloudflare | `cloudflare-workers-kv-legacy-routes-2026-10-15` | https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/ | endpoint_removed | provider + endpoint | high | TS/JS IR benchmark | needs_review |
| microsoft-azure | `microsoft-azure-api-version-retirement-pre-2021-08-01-2024-06-01` | https://learn.microsoft.com/en-us/azure/api-management/breaking-changes/api-version-retirement-sep-2023 | api_version_retired | provider + api_version | high | TS/JS IR benchmark | needs_review |
| square | `square-customer-cards-field-retired-2025-01-23` | https://developer.squareup.com/docs/changelog/connect-logs/2025-01-23 | response_field_removed | provider + response_field + api_version | high | TS/JS IR benchmark | needs_review |
| gitlab | `gitlab-subscription-api-endpoints-removal-v5` | https://docs.gitlab.com/update/deprecations/ | endpoint_removed | provider + resource + api_version | high | TS/JS IR benchmark | needs_review |
| discord | `discord-social-sdk-default-scopes-removal-2025-03-26` | https://discord.com/developers/docs/social-sdk/release_notes.html | method_removed | provider + operation | high | TS/JS IR benchmark | needs_review |
| atlassian | `atlassian-admin-v1-users-groups-api-removal-2027-06-30` | https://developer.atlassian.com/cloud/admin/changelog/ | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| auth0 | `auth0-enabled-clients-field-deprecation-2026-07-13` | https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations | response_field_removed | provider + response_field | high | TS/JS IR benchmark | needs_review |
| linear | `linear-mcp-sse-endpoint-removal-2026` | https://linear.app/changelog/page/3 | endpoint_removed | provider + endpoint | high | TS/JS IR benchmark | needs_review |
| deepgram | `deepgram-legacy-intelligence-parameters-2025-11-05` | https://developers.deepgram.com/changelog/2025/11/5 | parameter_removed | provider + parameter | high | TS/JS IR benchmark | needs_review |
| cohere | `cohere-embed-v2-model-retirement-2026-04-04` | https://docs.cohere.com/docs/deprecations | model_retired | provider + model | high | TS/JS IR benchmark | needs_review |
| mistral | `mistral-ocr-4-0-model-retirement-2026-09-30` | https://docs.mistral.ai/resources/changelogs | model_retired | provider + model | high | TS/JS IR benchmark | needs_review |
| neon | `neon-api-reference-site-retirement` | https://api-docs.neon.tech/reference/getting-started-with-neon-api | endpoint_removed | provider + resource | medium | TS/JS IR benchmark | needs_review |
| elasticsearch | `elasticsearch-monitoring-plugin-removal-10` | https://www.elastic.co/docs/release-notes/elasticsearch/deprecations | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
| algolia | `algolia-update-task-v1-deprecation` | https://www.algolia.com/doc/rest-api/ingestion/update-task-v1 | endpoint_removed | provider + endpoint | medium | TS/JS IR benchmark | needs_review |
| aws | `aws-cloudwatch-evidently-service-deprecation-2026-06-03` | https://docs.aws.amazon.com/step-functions/latest/dg/awssdk-release-history.html | endpoint_removed | provider + resource | high | TS/JS IR benchmark | needs_review |
