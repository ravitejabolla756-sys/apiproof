# MY OWL provider expansion progress

Last updated: 2026-10-13

This document is an engineering inventory, not a production-support claim. A
provider is counted as reviewed only when its reviewed compatibility record is
in `PRODUCTION_COMPATIBILITY_REGISTRY`. Discovery entries and review-gated
candidates do not increase that count.

## Current counts

| Inventory | Count | Meaning |
| --- | ---: | --- |
| Starting reviewed providers | 15 | Baseline before this expansion run |
| Current reviewed providers | 15 | Unchanged; no new human review was fabricated |
| Current reviewed compatibility rules | 20 | Unchanged production registry |
| Discovery catalog providers | 150 | Provider identification metadata only |
| Official candidate records | 78 | 10 existing records plus 68 expansion candidates |
| Providers represented by candidate records | 66 | Candidates remain `needs_review` |

The current production product remains deterministic, detection-only, and
limited to the 15 reviewed providers / 20 reviewed rules. Migration planning,
code rewriting, and Draft PR generation are not implied by this inventory.

## Batch 05: domain-only discovery expansion

The discovery catalog now includes 30 additional official documentation-backed
provider identities: Stripe, Airtable, Notion, Asana, Trello, monday.com,
Pipedrive, Close, Gong, Intercom, Zendesk, Freshdesk, CockroachDB, Turso,
Prisma, Hasura, Convex, Appwrite, Fauna, Fastly, Cloudinary, Fly.io, Heroku,
Bitrise, CircleCI, Buildkite, Docker, PostHog, Mux, and Mapbox. These entries
use only deterministic API-domain identification and are intentionally marked
`discovery`; they do not claim package/version awareness, compatibility rules,
deprecation evidence, or production support.

## Batch 06: discovery catalog completion

The catalog now reaches 150 deterministic provider identities after adding
official documentation-backed domains across AI, cloud, databases, CI/CD,
communications, payments, and commerce. These records are also discovery-only;
the catalog count must not be read as compatibility coverage or a reviewed
production-support claim.

## Reviewed provider matrix

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| OpenAI | AI / Models | Official deprecation records | 2 | 2 | Passed | REVIEWED |
| Anthropic | AI / Models | Official model deprecations | 2 | 2 | Passed; one parameter productization case remains partial by design | REVIEWED |
| GitHub | Developer Platforms | Official changelog records | 2 | 2 | Passed | REVIEWED |
| Twilio | Communications | Official changelog/docs | 2 | 2 | Passed | REVIEWED |
| Supabase | Backend / Database | Official changelog records | 2 | 2 | Passed | REVIEWED |
| Slack | Communications | Official changelog | 1 | 1 | Passed | REVIEWED |
| Shopify | Commerce / CRM | Official changelog | 1 | 1 | Passed | REVIEWED |
| LaunchDarkly | Feature Flags | Official API version changelog | 1 | 1 | Passed | REVIEWED |
| AWS | Cloud / Infrastructure | Official CloudWatch document history | 1 | 1 | Passed | REVIEWED |
| Cloudflare | CDN / Networking | Official API deprecation notice | 1 | 1 | Passed | REVIEWED |
| ElevenLabs | Audio / Voice | Official changelog | 1 | 1 | Passed | REVIEWED |
| Clerk | Identity | Official upgrade guide | 1 | 1 | Passed | REVIEWED |
| Groq | AI / Models | Official deprecation documentation | 1 | 1 | Passed | REVIEWED |
| Firebase | Cloud / Infrastructure | Official FCM deprecation documentation | 1 | 1 | Passed | REVIEWED |
| Google Cloud | Cloud / Infrastructure | Official API Registry release notes | 1 | 1 | Passed | REVIEWED |

## Batch 01: new review-gated candidates

These records are normalized from official documentation, have deterministic
provider/scoped targets, and are intentionally not in the production registry.
They require a separate human review before any production promotion.

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Google Gemini | AI / Models | [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations); Gemini 2.0 Flash shutdown 2026-06-01 | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| Bitbucket | Developer Platforms | [Bitbucket teams API notice](https://developer.atlassian.com/cloud/bitbucket/bitbucket-api-teams-deprecation/); `/2.0/teams/` to `/2.0/workspaces/` | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| Amplitude | Analytics / Data | [User Privacy API](https://amplitude.com/docs/apis/analytics/user-privacy); v1 endpoint and v2 replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

## Batch 02: API lifecycle candidates

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Salesforce | Commerce / CRM | [API End-of-Life Policy](https://developer.salesforce.com/docs/platform/api-rest/guide/api-rest-eol.html); Platform API versions 21.0 through 30.0 retired | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| HubSpot | Commerce / CRM | [Contact Lists API v1 sunset](https://developers.hubspot.com/changelog/extension-contact-lists-api-v1-sunset-moved-to-april-30-2026); Lists v3 replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

## Batch 03: endpoint and response-field lifecycle candidates

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Netlify | Cloud / Infrastructure | [Analytics v1 API notice](https://answers.netlify.com/t/analytics-v1-api-deprecation/46760); v1 retirement and 404 behavior | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| WorkOS | Identity | [raw_attributes deprecation](https://workos.com/docs/deprecations/raw-attributes); `custom_attributes` replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

## Batch 04: legacy integration candidates

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Braintree | Payments / Fintech | [Braintree SDK upgrade guide](https://developer.paypal.com/braintree/docs/reference/general/upgrade); Transparent Redirect replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| DigitalOcean | Cloud / Infrastructure | [Paperspace Core API reference](https://docs.digitalocean.com/reference/paperspace/core/); legacy API unavailable since 2024-07-15 | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

## Batch 07: Zoom Phone lifecycle candidates

These candidates use two separate official Zoom changelog notices. They remain
review-gated and do not add Zoom to the reviewed production registry.

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Zoom | Communications | [Phone API endpoint deprecations](https://developers.zoom.us/changelog/phone/phone-api-endpoint-deprecations/); legacy phone-number, plan, cloud-peering, SMS-campaign, and settings endpoint families; migrate by 2026-06-30; full sunset 2026-12-30; Number Management APIs replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| Zoom | Communications | [Call Log API deprecation](https://developers.zoom.us/changelog/phone/deprecation-of-call-log-apis-and-enhancements-to-call-history-apis/); v1 Call Logs APIs deprecated in May 2026; v2 Call History APIs replacement | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

## Batch 08: CI and customer-support API candidates

| Provider | Category | Evidence | Rules | Fixtures | Tests | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| CircleCI | CI/CD | [v1/v1.1 Trigger and Rerun API removal](https://circleci.com/changelog/deprecation-of-v1-and-v1-1-trigger-and-rerun-apis-february-1-2027/); ten exact endpoints removed 2027-02-01; v2/v3 replacements | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |
| Intercom | Customer Support | [Run Assignment Rules reference](https://developers.intercom.com/docs/references/2.8/rest-api/api.intercom.io/conversations/autoassignconversation); exact endpoint removed 2026-12-31 | 0 | 0 | Candidate and promotion-gate tests | NEEDS_REVIEW |

The exact candidate IDs are:

- `google-gemini-gemini-2-0-flash-shutdown-2026-06-01`
- `bitbucket-teams-api-removal-2020-10-14`
- `amplitude-user-privacy-api-v1-deprecation`
- `salesforce-platform-api-v21-30-retirement-2025`
- `hubspot-contact-lists-api-v1-sunset-2026-04-30`
- `netlify-analytics-v1-endpoint-retirement-2021-11-22`
- `workos-raw-attributes-fields-removed-2026-04-15`
- `braintree-transparent-redirect-deprecation`
- `digitalocean-paperspace-core-api-retirement-2024-07-15`

No SDK package, SDK version, SDK method, credential, endpoint family beyond
the captured target, or undocumented behavior is asserted by these records.

## Existing review-gated backlog

The remaining expansion candidates are retained in
`packages/providers/src/expansion-change-candidates.ts`. They cover official
source captures for additional providers including Algolia, Atlassian, Auth0,
AWS, Cloudflare, Cohere, Databricks, Datadog, Deepgram, Discord, Elasticsearch,
GitLab, Google Cloud, LaunchDarkly, Linear, Microsoft Azure, Mistral, MongoDB,
Neon, New Relic, Okta, Shopify, Slack, Snowflake, Square, and Vercel. They are
not reviewed production rules.

Discovery providers still without a reviewed rule or expansion candidate are:

`razorpay`, `resend`, `segment`, `sendgrid`.

## Batch 09: communications, observability, payments, and billing API candidates

Batch 09 added five deterministic, review-gated candidates from official API
references: Mailgun Events to Logs API, Sentry project issues to Organization
Issues, PayPal Invoicing v1 to v2, Chargebee item entitlements to Manage
entitlements, and Adyen Terminal Management v1 `assignTerminals` to the
documented reassign endpoint. These are candidates only; no provider was
added to the reviewed production registry and no SDK scope was inferred.

## Batch 10: payments, email, AI infrastructure, and commerce lifecycle candidates

Batch 10 added five deterministic, review-gated candidates from official
provider documentation and advisories: Plaid’s API 2020-09-14 `public_key`
authentication removal and `country_codes` requirement, Postmark’s
`/bounces/tags` deprecation, Replicate’s `cog.File` removal in the new Cog
runtime, and WooCommerce’s Legacy REST API removal from core. These candidates
remain limited to their documented API version, endpoint, parameter, or
resource scopes and do not add providers to the reviewed production registry.

## Batch 11: AI infrastructure, database, workflow, and payments lifecycle candidates

Batch 11 added seven deterministic, review-gated candidates from official
provider sources: Hugging Face `huggingface_hub` v2 removal of
`upload_large_folder`, three PlanetScale lifecycle records covering legacy
connection strings, `pscale workflow`, and pre-v0.182 CLI commands, Upstash
Kafka discontinuation, and two Paddle deprecations covering
`stored_payment_method_id` and the `balance` report type. The PlanetScale
legacy connection-string candidate preserves the documented brownout start but
does not invent a final removal date; the Upstash candidate likewise preserves
the absence of an exact shutdown date. All remain `needs_review` and outside
the reviewed production registry.

## Batch 12: Render access lifecycle candidate

Batch 12 added one deterministic, review-gated Render candidate from the
official changelog: legacy service sharing is deprecated, has no scheduled
end-of-life date, and should be replaced by workspace membership and roles.
The candidate remains `needs_review` and outside the reviewed production
registry.

## Batch 13: Together and Redis lifecycle candidates

Batch 13 added three deterministic, review-gated candidates from official
sources: Together Python SDK v2 removal of `client.files.retrieve_content`,
Redis’s `CLUSTER SLAVES` to `CLUSTER REPLICAS` rename, and Redis Cloud’s
discontinued Triggers and Functions preview commands. All remain
`needs_review` and outside the reviewed production registry.

## Batch 14: Railway configuration lifecycle candidate

Batch 14 adds one deterministic, review-gated Railway candidate from the
official Config as Code documentation: existing `railway.json` and
`railway.toml` configurations have a hard cutoff on 2026-12-01 and Railway
directs new configuration to Infrastructure as Code via `.railway/railway.ts`.
The candidate remains `needs_review` and outside the reviewed production
registry.

## Batch 15: Perplexity model lifecycle candidate

Batch 15 adds one deterministic, review-gated Perplexity candidate from the
[official API changelog](https://docs.perplexity.ai/docs/resources/changelog):
`google/gemini-3.1-flash-lite-preview` is retired and requests using it are no
longer supported; the documented replacement is
`google/gemini-3.1-flash-lite`. The candidate is limited to provider + model
scope and remains outside the reviewed production registry.

## Batch 16: Mixpanel headless SDK lifecycle candidate

Batch 16 adds one deterministic, review-gated Mixpanel candidate from the
[official SDK changelog](https://raw.githubusercontent.com/mixpanel/mixpanel-headless/main/CHANGELOG.md):
version 0.2.0 sunsets JQL as a breaking change. The candidate is limited to
the `mixpanel-headless` package, version 0.2.0 and later, and the JQL operation;
it remains outside the reviewed production registry.

The discovery catalog currently contains 150 providers. The Batch 05/06
records are discovery-only and remain outside the reviewed compatibility
registry. Further expansion work should prioritize evidence-backed lifecycle
candidates and deterministic fixtures rather than adding more names.

## Validation evidence

- `pnpm providers:validate:all --markdown`: existing 15-provider engine cases
  remain 60/60; productization projection remains 19/20 positive with the
  documented Anthropic parameter limitation; reviewed production rules remain
  20.
- Batch 16 targeted candidate, fixture-coverage, bundle, review, benchmark, and
  promotion-gate tests: 6 files, 16 tests passed.
- Full serial suite: 146 files passed, 1 skipped; 1,319 tests passed, 4 skipped.
- Root typecheck, lint, and production build passed. The build retains only the
  pre-existing optional `source-map-support` and Next.js ESLint plugin warnings.
- The new candidates are lifecycle `needs_review` records and do not alter the
  reviewed registry, scanner behavior, staging configuration, or external
  repositories.

## Safety boundary

No Production deployment, Production database operation, external repository
write, GitHub permission change, secret exposure, or Vercel configuration
change was performed for this batch. The pre-existing `.gitignore` worktree
modification remains outside the batch.
