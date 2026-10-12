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
| Discovery catalog providers | 67 | Provider identification metadata only |
| Official candidate records | 46 | 10 existing records plus 36 expansion candidates |
| Providers represented by candidate records | 40 | Candidates remain `needs_review` |

The current production product remains deterministic, detection-only, and
limited to the 15 reviewed providers / 20 reviewed rules. Migration planning,
code rewriting, and Draft PR generation are not implied by this inventory.

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

The exact candidate IDs are:

- `google-gemini-gemini-2-0-flash-shutdown-2026-06-01`
- `bitbucket-teams-api-removal-2020-10-14`
- `amplitude-user-privacy-api-v1-deprecation`
- `salesforce-platform-api-v21-30-retirement-2025`
- `hubspot-contact-lists-api-v1-sunset-2026-04-30`

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

`adyen`, `braintree`, `chargebee`, `digitalocean`, `hubspot`, `hugging-face`,
`mailgun`, `mixpanel`, `netlify`, `paddle`, `paypal`, `perplexity`, `plaid`,
`planetscale`, `postmark`, `railway`, `razorpay`, `redis`, `render`, `replicate`,
`resend`, `salesforce`, `segment`, `sendgrid`, `sentry`, `together-ai`, `upstash`,
`woocommerce`, `workos`.

The discovery catalog currently contains 67 providers. Reaching a catalog of
150 requires additional source-backed provider records; no name-only entries
are being added to close that numerical gap.

## Validation evidence

- `pnpm providers:validate:all --markdown`: existing 15-provider engine cases
  remain 60/60; productization projection remains 19/20 positive with the
  documented Anthropic parameter limitation; reviewed production rules remain
  20.
- Targeted candidate/provenance/promotion tests after Batch 02: 4 files,
  21 tests passed.
- The new candidates are lifecycle `needs_review` records and do not alter the
  reviewed registry, scanner behavior, staging configuration, or external
  repositories.

## Safety boundary

No Production deployment, Production database operation, external repository
write, GitHub permission change, secret exposure, or Vercel configuration
change was performed for this batch. The pre-existing `.gitignore` worktree
modification remains outside the batch.
