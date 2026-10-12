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
  });
});
