# MY OWL migration-template promotion runbook

This runbook is for promoting one provider migration from review-only guidance to a verified executable template. Promotion is candidate-specific: a provider having one executable template does not make its other migrations executable.

## Safety boundary

Only promote a template when all of the following are true:

- the exact candidate has a concrete, source-backed transformation;
- the transformation is behavior-preserving for the supported syntax and language;
- the official source, evidence, and candidate fingerprints are unchanged;
- a human reviewer has recorded one affected, one unaffected, and one uncertain fixture;
- the bundled registry change is schema-valid and its `changeDigest` matches the transformation rule;
- the transformation does not require a semantic workflow rewrite, service selection, authentication change, payload redesign, or multiple coordinated API calls.

If any condition is missing, keep the candidate review-only and use its manual migration playbook.

## Promotion procedure

1. Generate the current review pack and identify the exact candidate ID:

   ```text
   pnpm provider:review-pack
   pnpm provider:review-report
   ```

2. Open the authenticated provider-rule review page. Confirm the candidate's official source URL, source fingerprint, evidence fingerprint, candidate fingerprint, applicability scope, detector tokens, and unknowns.

3. Re-check the official source. Do not reuse an older review if the source body or source fingerprint changed.

4. Prepare three repository-independent fixtures:

   - `affected`: the bounded detector token must match;
   - `unaffected`: the detector token must not match;
   - `uncertain`: dynamic or ambiguous usage must remain `NEEDS_REVIEW`.

   The affected and unaffected fixtures are evaluated by the approval service. The uncertain fixture is retained as evidence that the rule does not overclaim dynamic behavior.

5. If, and only if, the transformation is deterministic, attach a migration template whose `sources` array contains the exact candidate official source URL. Keep limitations explicit, such as direct string literals only, supported language, and alias/dynamic-expression exclusions.

6. Approve the candidate through the review flow. The service validates the candidate schema, applicability scope, source binding, and fixture outcomes before creating the approved rule and rescan jobs.

7. Add the exact template ID to the static migration coverage catalog and add matching reviewed registry assets:

   - `registry/<provider>/<template-id>.json`;
   - the matching rule in `registry/patches/transformations.json`;
   - a `changeDigest` computed from the schema-valid reviewed registry change.

   The registry review must be independently human-attributed. Agent-authored review is not sufficient for executable-template readiness.

8. Run the verification gates:

   ```text
   pnpm exec vitest run tests/provider-template-proposals.test.ts tests/provider-review-pack.test.ts tests/provider-review-coverage-report.test.ts tests/provider-rule-scope.test.ts
   pnpm typecheck
   pnpm lint
   pnpm beta:readiness
   ```

   `beta:readiness` must show the candidate under verified migration templates and remove it from the promotion queue. A green provider-level declaration alone is insufficient.

## Candidates that must remain manual until proven otherwise

The current queue contains migrations involving semantic or multi-step changes, including AWS SDK v2→v3, Slack external uploads, Auth0 endpoint-specific behavior, Google Cloud MCP replacement, Braintree checkout redesign, Vercel webhook configuration, and Stripe resource/response-shape migrations. These must not receive text-only templates.

## Audit record

Record the reviewer identity, review date, source URL, source/evidence/candidate fingerprints, fixture paths and outcomes, supported languages, limitations, test results, and rollback plan with the release artifact. Never claim public beta readiness from local fixtures alone; live GitHub onboarding, production cron execution, configuration, backups, and restore evidence are separate gates.
