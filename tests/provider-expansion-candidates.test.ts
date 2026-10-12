import { describe, expect, it } from 'vitest';
import { EXPANSION_OFFICIAL_CHANGE_CANDIDATES, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY, fingerprintCandidate } from '@apiproof/providers';

describe('overnight provider expansion candidates', () => {
  it('adds the verified official-source candidate set without changing production rules', () => {
    expect(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.length).toBeGreaterThanOrEqual(34);
    expect(new Set(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.map((candidate) => candidate.providerId)).size).toBeGreaterThanOrEqual(33);
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
  });
});
