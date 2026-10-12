# MY OWL provider expansion final report

Date: 2026-10-13

This report distinguishes deterministic provider discovery from reviewed
compatibility support. Discovery metadata does not promote a provider into the
production compatibility registry.

## Counts

STARTING PROVIDERS: 15 reviewed providers; 67 discovery providers
FINAL IMPLEMENTED PROVIDERS: 150 deterministic discovery identities
FINAL REVIEWED PROVIDERS: 15
TOTAL RULES: 20 reviewed production rules; 64 review-gated candidate records
representing 56 provider IDs
AFFECTED FIXTURES: 19 productization-positive findings; the reviewed engine
matrix is 60/60
NOT_AFFECTED FIXTURES: Covered by the 60/60 reviewed engine matrix; no new
production claim is inferred from discovery-only records
NEEDS_REVIEW: 64 candidate records; all remain `needs_review`; the Anthropic
parameter productization case remains explicitly partial
BLOCKED: Human review and deterministic fixture work are still required before
any candidate can become a reviewed production rule

## Discovery providers added

The 83 new discovery-only identities are:

Stripe, Airtable, Notion, Asana, Trello, monday.com, Pipedrive, Close, Gong,
Intercom, Zendesk, Freshdesk, CockroachDB, Turso, Prisma, Hasura, Convex,
Appwrite, Fauna, Fastly, Cloudinary, Fly.io, Heroku, Bitrise, CircleCI,
Buildkite, Docker, PostHog, Mux, Mapbox, Fireworks AI, Stability AI, Voyage AI,
AssemblyAI, Cartesia, AI21 Labs, Cerebras, SambaNova, NVIDIA NIM, Oracle Cloud,
IBM Cloud, Alibaba Cloud, Akamai Cloud, Vultr, Hetzner Cloud, Scaleway,
OVHcloud, Bunny.net, UpCloud, Backendless, Parse Platform, Couchbase, Nhost,
PocketBase, Xata, Travis CI, Codecov, SonarCloud, JFrog, Semaphore, npm,
Python Package Index, Sourcegraph, GitKraken, Zoom, Webex, Vonage, Telnyx,
Pusher, Ably, OneSignal, Mailchimp, Customer.io, Klarna, Mollie, GoCardless,
Worldpay, Checkout.com, Recurly, Wise, Airwallex, Finix, and DocuSign.

Each is domain-only discovery metadata backed by an official documentation URL;
none claims package/version awareness, deprecation applicability, a reviewed
compatibility rule, or production support.

## Evidence and review state

The expansion batches added source-backed candidate records for Google Gemini,
Bitbucket, Amplitude, Salesforce, HubSpot, Netlify, WorkOS, Braintree,
DigitalOcean, Zoom Phone, CircleCI, and Intercom. The Zoom batch covers legacy
Phone endpoint families and v1 Call Logs; the latest batch covers CircleCI’s
legacy trigger/rerun endpoints and Intercom’s assignment-rules endpoint. Their
source, evidence, applicability, fingerprints, and unknowns remain
review-gated. No reviewer metadata or production-registry entry was fabricated.

Batch 09 adds Mailgun, Sentry, PayPal, Chargebee, and Adyen API lifecycle
candidates. Batch 10 adds two narrowly scoped Plaid API 2020-09-14 candidates,
Postmark `/bounces/tags`, Replicate `cog.File`, and WooCommerce Legacy REST API
lifecycle candidates. Each remains `needs_review` and is outside the reviewed
production registry pending human review and deterministic fixture work.

The 15 reviewed providers and 20 reviewed rules remain unchanged. The known
Anthropic parameter shape remains `NOT_AFFECTED (PARTIAL)` in productization;
the engine still preserves its authoritative `AFFECTED`, `NOT_AFFECTED`, and
`NEEDS_REVIEW` cases.

## Validation

TEST RESULTS: `pnpm test -- --maxWorkers=1` passed with 146 test files passed,
1 skipped, 1,319 tests passed, and 4 skipped.

TARGETED TESTS: Batch 10 candidate, bundle, review-workflow, and promotion-gate
suites passed (4 files, 13 tests).

TYPECHECK: PASS (`pnpm typecheck`)
LINT: PASS (`pnpm lint`)
BUILD: PASS (`pnpm build`). Existing non-fatal warnings remain for the
optional `source-map-support` resolution and missing Next.js ESLint plugin.
PROVIDER VALIDATION: PASS (`pnpm providers:validate:all --markdown`); reviewed
engine 60/60, productization positives 19/20, proofs 20, findings 19.

The default parallel test mode has a known pre-existing SQLite fixture
contention issue; the serial command above is the reliable full-suite gate and
does not hide application failures.

## Checkpoint commits

- `33cf6928cfc7f3129ed4aa749f3e913008b1826f` — Batch 01 candidates
- `fdeb212ad07dba36caca6aee4a7d238e12717e0d` — Batch 02 candidates
- `c165c3f60f30138e2328be6a4ace35290687a83b` — Batch 03 candidates
- `481dbdc0364db8f9cf182f2a2b6e56f8783adc4a` — Batch 04 candidates
- `ffb3e1d` — Batch 05 discovery catalog
- `a774340` — Batch 06 discovery catalog completion
- `6b8f680` — Batch 07 Zoom lifecycle candidates
- `9ec912b` — Batch 08 CircleCI and Intercom lifecycle candidates
- `1496a41b2aabc587b0fdf3d213852b5a90830362` — Batch 09 Mailgun, Sentry,
  PayPal, Chargebee, and Adyen lifecycle candidates
- `de58a5c4e3ca55766350b843fea44d25f6ac1dab` — Batch 10 Plaid, Postmark,
  Replicate, and WooCommerce lifecycle candidates

PRODUCTION_TOUCHED=NO
PRODUCTION_DB_TOUCHED=NO
GITHUB_WRITE_PERMISSIONS_CHANGED=NO
SECRETS_EXPOSED=NO

## Remaining work

The discovery catalog is complete at 150, but compatibility coverage is not.
The next safe phase is evidence capture for the remaining discovery providers,
followed by deterministic affected/not-affected/needs-review fixtures and a
separate human-review workflow. No provider should be counted as reviewed or
production-supported until those gates pass.
