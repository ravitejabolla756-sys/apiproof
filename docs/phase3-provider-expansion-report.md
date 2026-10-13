# Phase 3 provider expansion report

Date: 2026-10-13

## Scope and safety boundary

Phase 3 starts from checkpoint `fc2fd8801a6dd5162ca4662f917c19f6e1dc8432`.
The canonical candidate queue, human-review workflow, promotion gates, and
`PRODUCTION_COMPATIBILITY_REGISTRY` were not modified. All Phase 3 projections
are test-only and do not represent a human review or a production promotion.

The pre-existing `.gitignore` modification remains outside this work.

## Blocker classification

The 78 Phase 2 candidates remain `needs_review`. The recurring blockers fall
into four categories:

1. **Governance:** no persisted human review binding with matching source,
   evidence, and candidate fingerprints. This is not locally resolvable without
   an explicit reviewer decision.
2. **Evidence-to-fixture gap:** most candidates lack a candidate-specific
   positive, negative, and unresolved source fixture through the real analyzer
   path. A structural evaluator projection is not sufficient evidence.
3. **Analyzer-shape gap:** endpoint records that encode `GET`/`POST` in the
   endpoint identity cannot currently be proven by the HTTP extractor, which
   records the literal URL/path but not the request method. This excludes the
   CircleCI and HubSpot endpoint candidates from this proposal set.
4. **Language coverage gap:** the Python adapter currently recognizes HTTP
   resource usage and headers but does not extract a `model` property from a
   `requests`/`httpx` JSON body. It therefore must not claim model applicability
   for the Python fixtures in this batch.

The four Phase 2 research gaps remain unchanged: Razorpay, Resend, Segment,
and SendGrid still have `NO_DEFENSIBLE_RULE_FOUND`.

## Selected candidates and official evidence

| Candidate | Scope | Official evidence | Local proposal status |
| --- | --- | --- | --- |
| `google-gemini-gemini-2-0-flash-shutdown-2026-06-01` | provider + model | Google lists `gemini-2.0-flash` and `gemini-2.0-flash-001` as shut down on 2026-06-01 and names `gemini-3.6-flash`. <https://ai.google.dev/gemini-api/docs/deprecations> | tested |
| `perplexity-gemini-3-1-flash-lite-preview-retired` | provider + model | Perplexity states that `google/gemini-3.1-flash-lite-preview` is retired and directs users to `google/gemini-3.1-flash-lite`. <https://docs.perplexity.ai/docs/resources/changelog> | tested |
| `cohere-embed-v2-model-retirement-2026-04-04` | provider + model | Cohere lists the exact Embed v2.0 and Aya 8B model IDs as unavailable from 2026-04-04 and documents replacement families. <https://docs.cohere.com/changelog/2026-04-04-embed-v2-aya-8b-retirement> | tested |
| `mistral-ocr-4-0-model-retirement-2026-09-30` | provider + model | Mistral marks `mistral-ocr-4-0` deprecated and retiring on 2026-09-30, with OCR 4.1/current alias guidance. <https://docs.mistral.ai/resources/changelogs> | tested |

These four candidates have a concrete static model identifier, an official
source, and a deterministic provider-specific source route through the current
TypeScript analyzer. The local proposal tests use test-only reviewed-shaped
projections so the compatibility evaluator can be exercised without changing
the production registry.

## Tested behavior

`tests/phase3-provider-expansion-proposals.test.ts` runs each candidate through:

- provider discovery from a literal provider API URL;
- the actual `TypeScriptRepositoryAnalyzer`;
- normalized usage conversion;
- a test-only official projection of the candidate payload; and
- the compatibility evaluator.

For every selected candidate, the test proves:

- exact affected model: `AFFECTED`;
- named replacement model: `NOT_AFFECTED`;
- dynamic model value: `NEEDS_REVIEW`;
- static literal model fingerprint is retained without persisting source or
  credential values.

The test also records the current Python limitation: a Python `requests` JSON
body does not produce model evidence, so it does not produce a false positive.

## Promotion disposition

- Candidates genuinely unblocked for **local proposal testing:** 4.
- Tested local rule proposals: 4.
- Candidates ready for automatic promotion: 0.
- Candidates ready for human review: 4, subject to a reviewer independently
  verifying the current official source and approving the exact fingerprints,
  scope, and notes through `reviewCandidate()`.
- Recommended first promotion review: `google-gemini-gemini-2-0-flash-shutdown-2026-06-01`.

The first recommendation is limited to provider + model applicability. It does
not assert SDK package/version, endpoint, operation, client-library behavior,
or dynamic model resolution. No candidate was inserted into the production
registry.

## Follow-up blockers

1. Obtain explicit human review for one candidate at a time; do not reuse this
   test-only projection as review metadata.
2. After review, run the strict promotion gate against the reviewed copy and
   add real productization fixtures for the reviewed rule before any separate
   production-registry decision.
3. Add method-aware HTTP evidence before pursuing endpoint candidates such as
   CircleCI and HubSpot; do not broaden their endpoint scope to compensate.
4. Add a safe Python model-body extractor only as a separately reviewed analyzer
   change; do not infer model applicability from raw Python source text today.
