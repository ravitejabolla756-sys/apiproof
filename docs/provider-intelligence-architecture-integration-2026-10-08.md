# Provider Intelligence Staging Integration

## Branch ancestry

- Staging base: `provider-intelligence-staging` at `29ff625`.
- Validated expansion source: `provider-intelligence-expansion-overnight` at `410450b`.
- Integration branch: `provider-intelligence-staging-integration-v2`.
- The refs have no usable common Git ancestor in the isolated clone, so the integration was performed by subsystem rather than by a blind merge.

## Canonical architecture

The staging worker remains the runtime boundary:

GitHub fetch → repository snapshot → `runProductizationScan()` → normalized language-neutral IR → `PRODUCTION_COMPATIBILITY_REGISTRY` → deterministic evaluator → `productizationFindings()` → bounded/redacted persistence → Inventory / Map / Proof APIs → dashboard.

The expansion layer supplies the 15-provider/20-rule reviewed registry, candidate/review separation, official provenance/fingerprints, API-version/domain/auth evidence, and language-neutral compatibility fields. The staging layer supplies feature gating, tenant/repository authorization, worker failure handling, persistence bounds, and rollback behavior.

## Reconciliation decisions

- One `runProductizationScan()` remains in `packages/analyzers/src/productization.ts`.
- One normalized usage mapping remains in `packages/analyzers/src/typescript/usage-ir.ts`; Python and TypeScript feed the same IR.
- One registry evaluator remains in `packages/analyzers/src/typescript/compatibility.ts`.
- The staging `productizationFindings()` and `boundedProductizationProjection()` remain the only worker persistence boundary.
- Expansion analyzer behavior was reconciled as a superset: API-version extraction, safe hostname matching, auth/header redaction, model/resource/operation/endpoint/domain/parameter/response-field evidence, and dynamic/uncertain semantics are retained.

## Registry

The local reviewed registry contains 20 unique reviewed records across 15 providers: OpenAI 2, Anthropic 2, GitHub 2, Twilio 2, Supabase 2, Slack 1, Shopify 1, LaunchDarkly 1, AWS 1, Cloudflare 1, ElevenLabs 1, Clerk 1, Groq 1, Firebase 1, and Google Cloud 1. All records have official provenance and review metadata; candidate-only records are not compiled into production compatibility.

## Safety boundary

The Productization path does not execute repository code or call external AI. Raw source and secret values remain outside the persisted projection. Header evidence retains only safe static compatibility metadata; sensitive values are redacted or omitted. Repository proof routes remain repository-bound and tenant-authorized. Projection size and malformed/failed paths are handled by the staging persistence boundary.

## Validation evidence

- Focused registry/expansion/staging suites: passing.
- Real enabled-worker E2E suite: passing after creating only the ignored local `.tmp` test directory.
- Shared, core, providers, analyzers, and web typechecks: passing after workspace package builds.
- Full bounded Vitest: 1122 passed, 4 skipped, 44 failed. The failures are the pre-existing `FIXTURE_DIGEST_MISMATCH` patching corpus and related evaluation/patch CLI baseline failures; no provider-intelligence focused test failed.
- No cloud, production, credential, GitHub-write, push, or deployment action was performed.

## Remaining limitations

The full suite cannot be called green until the unrelated fixture/evaluation/patching baselines are repaired. This checkout proves the local integrated path and safety contracts; it does not prove a deployed staging worker or cloud configuration.
