import { describe, expect, it } from 'vitest';
import { EXPANSION_OFFICIAL_CHANGE_CANDIDATES, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY, fingerprintCandidate } from '@apiproof/providers';

describe('overnight provider expansion candidates', () => {
  it('adds the verified official-source candidate set without changing production rules', () => {
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.map((candidate) => candidate.providerId)).size).toBeGreaterThanOrEqual(39);
    expect(new Set(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.map((candidate) => candidate.candidateId)).size).toBe(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.length);
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => candidate.state === 'needs_review')).toBe(true);
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => candidate.sourceFingerprintBasis === 'full-body')).toBe(true);
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.sourceFingerprint))).toBe(true);
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.evidenceFingerprint ?? ''))).toBe(true);
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => fingerprintCandidate(candidate).length === 64)).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates).toHaveLength(10 + EXPANSION_OFFICIAL_CHANGE_CANDIDATES.length);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
  });

  it('retains concrete generic applicability scopes', () => {
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.every((candidate) => (candidate.payload.applicabilityScope?.dimensions?.length ?? 0) > 0)).toBe(true);
  });

  it('keeps the GitLab subscription-endpoint candidate review-gated when its official source says removal is being reassessed', () => {
    const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'gitlab-subscription-api-endpoints-removal');
    expect(candidate).toMatchObject({
      state: 'needs_review',
      documentFingerprint: '4533eaf82beac9bc8ca8e26f3a1d24088a0f64218133b893d4a8a54d24302521',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, severity: 'medium' },
    });
    expect(candidate?.sourceEvidence?.claims).toContainEqual({ key: 'milestoneStatus', value: 'removed from original milestone and being reassessed' });
  });

  it('retains source-proven target scopes for generic auth and response-field changes', () => {
    const cloudflare = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'cloudflare-service-key-auth-removal-2026-09-30');
    expect(cloudflare?.payload).toMatchObject({
      changeType: 'auth_or_header_removed',
      applicabilityScope: { dimensions: ['provider', 'auth_or_header'] },
      authOrHeaderPatterns: ['X-Auth-User-Service-Key'],
    });

    const square = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'square-customer-cards-field-retired-2025-01-23');
    expect(square?.payload).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'resource', 'response_field', 'api_version'] },
      affectedResources: ['Customer object'],
      affectedResponseFields: ['Customer.cards'],
    });

    const auth0 = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'auth0-enabled-clients-field-deprecation-2026-07-13');
    expect(auth0?.payload).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'endpoint', 'response_field'] },
      affectedEndpoints: ['GET /api/v2/connections', 'GET /api/v2/connections/{id}', 'PATCH /api/v2/connections/{id}'],
      affectedResponseFields: ['enabled_clients'],
    });
  });

  it('adds exact scopes for the next researched provider candidates without promoting them', () => {
    const gemini = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'google-gemini-gemini-2-0-flash-shutdown-2026-06-01');
    expect(gemini).toMatchObject({
      providerId: 'google-gemini', state: 'needs_review',
      payload: { changeType: 'model_retired', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedModels: ['gemini-2.0-flash', 'gemini-2.0-flash-001'] },
    });

    const bitbucket = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'bitbucket-teams-api-removal-2020-10-14');
    expect(bitbucket).toMatchObject({
      providerId: 'bitbucket', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['/2.0/teams/'] },
    });

    const amplitude = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'amplitude-user-privacy-api-v1-deprecation');
    expect(amplitude).toMatchObject({
      providerId: 'amplitude', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['/api/2/deletions/users'] },
    });

    const salesforce = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'salesforce-platform-api-v21-30-retirement-2025');
    expect(salesforce).toMatchObject({
      providerId: 'salesforce', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'api_version'] }, apiVersionMetadata: { version: '21.0 through 30.0' } },
    });

    const hubspot = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'hubspot-contact-lists-api-v1-sunset-2026-04-30');
    expect(hubspot).toMatchObject({
      providerId: 'hubspot', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /contacts/v1/lists', 'GET /contacts/v1/lists'] },
    });

    const netlify = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'netlify-analytics-v1-endpoint-retirement-2021-11-22');
    expect(netlify).toMatchObject({
      providerId: 'netlify', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['Analytics v1 API endpoints'] },
    });

    const workos = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'workos-raw-attributes-fields-removed-2026-04-15');
    expect(workos).toMatchObject({
      providerId: 'workos', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'resource', 'response_field'] }, affectedResponseFields: ['raw_attributes', 'job_title', 'username', 'emails'] },
    });

    const braintree = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'braintree-transparent-redirect-deprecation');
    expect(braintree).toMatchObject({
      providerId: 'braintree', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Transparent Redirect'] },
    });

    const digitalOcean = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'digitalocean-paperspace-core-api-retirement-2024-07-15');
    expect(digitalOcean).toMatchObject({
      providerId: 'digitalocean', state: 'needs_review',
      payload: { applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Paperspace Core API'] },
    });

    const zoomLegacy = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'zoom-phone-legacy-endpoints-sunset-2026-12-30');
    expect(zoomLegacy).toMatchObject({
      providerId: 'zoom', state: 'needs_review',
      sourceFingerprint: 'b14b8906362e41f5ff118c1c910f0a299023e83083d7e7e39f430a1dbc678e36',
      payload: { applicabilityScope: { dimensions: ['provider', 'resource'] }, removalAt: '2026-12-30', replacement: { resources: ['Zoom Number Management APIs'] } },
    });

    const zoomCallLogs = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'zoom-phone-v1-call-logs-deprecation-2026-05');
    expect(zoomCallLogs).toMatchObject({
      providerId: 'zoom', state: 'needs_review',
      sourceFingerprint: '264c6e0bf8798f74626c82b8031556d5b932e0bcddc220fb9c106be0ed097198',
      payload: { applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Zoom Phone v1 Call Logs APIs'], replacement: { resources: ['Zoom Phone v2 Call History APIs'] } },
    });

    const circleCi = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'circleci-v1-trigger-rerun-api-removal-2027-02-01');
    expect(circleCi).toMatchObject({
      providerId: 'circleci', state: 'needs_review',
      sourceFingerprint: '4cf20b30da99c918ade80e77815ccdf0c641780dc76d3042b2373d878fe92b3d',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, removalAt: '2027-02-01', affectedEndpoints: expect.arrayContaining(['POST /api/v1/project/:username/:repo/']) },
    });

    const intercom = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'intercom-run-assignment-rules-endpoint-removal-2026-12-31');
    expect(intercom).toMatchObject({
      providerId: 'intercom', state: 'needs_review',
      sourceFingerprint: '0bde5904dfb4612004df81c868be2bb6f9391cfdc9568bff2ede7701832f7dbd',
      payload: { applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /conversations/{id}/run_assignment_rules'], removalAt: '2026-12-31' },
    });

    const plaidAuth = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'plaid-public-key-auth-removal-api-2020-09-14');
    expect(plaidAuth).toMatchObject({
      providerId: 'plaid', state: 'needs_review',
      sourceFingerprint: '4146449358a1f8db3324f38f034d4b7ffeaede466f2d0bea629330a74bfe1ffa',
      evidenceFingerprint: 'f29895ae53ef7c1c89939e7af525443273f7faeded820d609f4f417bc7acc544',
      payload: { changeType: 'parameter_removed', applicabilityScope: { dimensions: ['provider', 'api_version', 'endpoint', 'parameter'] }, affectedParameters: ['public_key'] },
    });

    const plaidCountryCodes = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'plaid-institutions-country-codes-required-api-2020-09-14');
    expect(plaidCountryCodes).toMatchObject({
      providerId: 'plaid', state: 'needs_review',
      evidenceFingerprint: 'a9ab87d5c984e12529554cbad62fa51e30c0b876b1c485fae69b63a34361450c',
      payload: { changeType: 'parameter_required', applicabilityScope: { dimensions: ['provider', 'api_version', 'endpoint', 'parameter'] }, affectedParameters: ['country_codes'] },
    });

    const postmark = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'postmark-bounces-tags-endpoint-deprecation-2019-12-02');
    expect(postmark).toMatchObject({
      providerId: 'postmark', state: 'needs_review',
      sourceFingerprint: '2085210af0bec50ef580292537f271e97e403b5b639e9ec41c477f9249cdc3df',
      payload: { changeType: 'endpoint_removed', removalAt: '2019-12-02', affectedEndpoints: ['/bounces/tags'] },
    });

    const replicate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'replicate-cog-file-api-removal-new-runtime-2025-07-21');
    expect(replicate).toMatchObject({
      providerId: 'replicate', state: 'needs_review',
      payload: { changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['cog.File'] },
    });

    const woocommerce = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'woocommerce-legacy-rest-api-core-removal-9-0');
    expect(woocommerce).toMatchObject({
      providerId: 'woocommerce', state: 'needs_review',
      payload: { changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Legacy REST API', 'legacy webhooks'] },
    });

    const batch11Expected = [
      ['huggingface-hub-v2-deprecated-api-removals', '265960785887d32d4533398a220c575508512fa130c4d47738c515aa724831ec', '1fa58b30e83f59a0e7d9ed0d5bf6c4e0594bb38ca514e9506deafb23f0b74826'],
      ['planetscale-legacy-connection-string-brownout-2024-09-03', 'b7c66274efa62f81e9b0930143493639906ee962bf9a8eca45810ce967e2fc59', '8574e076d9f883dc2190f64e62547621e29454b9d0867d9b382d02985d4780a6'],
      ['planetscale-pscale-workflow-deprecation-2026-09-29', 'e0bff4aeab13244175ad9224827922ca23c32ca6dfd4a2c365330ae8dad982a3', '794732a382091cf0abbd282012973ec72d82a5933e6d14c820af704acedea6a2'],
      ['planetscale-cli-pre-0-182-commands-removed-2024-07-01', '737f8661a18d80eac6854f47942f498384ac71174dabc4b607b22471737c505c', '719f1fbc065cdeae90c89b93a9e5c25f828695c1d1ec2a37d491770c9e69abc0'],
      ['upstash-kafka-discontinuation-2025', 'f56c7fe7fefc9aacf3571140e3f7e53749fe467492a3124fbc6870ae95ae09d7', 'a95eff4ff7783f5c3ce851f4eecf0c876d847d20893ccc0017a0e561f51c26eb'],
      ['paddle-stored-payment-method-id-deprecated', '6419b13fd15453d98b1b3ba19175154e2dfda160b5954906a988fb04c255e2e4', '4bf8382299f66e652e5007da145026e16a0d084ba4c64c7b5e2a1619f53f12ad'],
      ['paddle-balance-report-type-deprecated', '1c86b636287037854eb63570d2a4e9fb4f06375142b55613556b09f2c0f608e5', 'fbbca93a49b25893574e5ee007068edd2e756a7efb93242266f90babd144fe06'],
    ] as const;
    for (const [candidateId, sourceFingerprint, evidenceFingerprint] of batch11Expected) {
      expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === candidateId)).toMatchObject({
        candidateId, state: 'needs_review', sourceFingerprint, evidenceFingerprint,
      });
    }
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'render-legacy-service-sharing-deprecated-2025-07-15')).toMatchObject({
      candidateId: 'render-legacy-service-sharing-deprecated-2025-07-15', state: 'needs_review', providerId: 'render',
      sourceFingerprint: 'f4325a92065c9f751ed6530310230c2d810da7a20a57657ea43336758a73ca03',
      evidenceFingerprint: 'd5489b1c718474a8fb0144c4122976436c1157c1a1d2a30060ad4e1f7a7b8132',
    });
  });
});
