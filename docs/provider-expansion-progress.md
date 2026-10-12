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
| Official candidate records | 52 | 10 existing records plus 42 expansion candidates |
| Providers represented by candidate records | 45 | Candidates remain `needs_review` |

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

`adyen`, `chargebee`, `hugging-face`, `mailgun`,
`mixpanel`, `paddle`, `paypal`, `perplexity`, `plaid`, `planetscale`, `postmark`,
`railway`, `razorpay`, `redis`, `render`, `replicate`, `resend`, `segment`,
`sendgrid`, `sentry`, `together-ai`, `upstash`, `woocommerce`.

The discovery catalog currently contains 150 providers. The Batch 05/06
records are discovery-only and remain outside the reviewed compatibility
registry. Further expansion work should prioritize evidence-backed lifecycle
candidates and deterministic fixtures rather than adding more names.

## Validation evidence

- `pnpm providers:validate:all --markdown`: existing 15-provider engine cases
  remain 60/60; productization projection remains 19/20 positive with the
  documented Anthropic parameter limitation; reviewed production rules remain
  20.
- Targeted candidate/provenance/promotion tests after Batch 04: 5 files,
  25 tests passed.
- The new candidates are lifecycle `needs_review` records and do not alter the
  reviewed registry, scanner behavior, staging configuration, or external
  repositories.

## Safety boundary

No Production deployment, Production database operation, external repository
write, GitHub permission change, secret exposure, or Vercel configuration
change was performed for this batch. The pre-existing `.gitignore` worktree
modification remains outside the batch.
