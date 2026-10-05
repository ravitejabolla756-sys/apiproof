import { describe, expect, it } from 'vitest';
import { compileProductionChangeRegistry, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, promoteCandidateToReviewed } from '@apiproof/providers';

const record = (overrides: Record<string, unknown> = {}) => ({
  providerId: 'openai', changeId: 'scope-fixture', title: 'Scope fixture', description: 'Applicability scope fixture.', changeType: 'model_retired',
  officialSourceUrl: 'https://example.com/official', sourceType: 'official-documentation', applicabilityScope: { dimensions: ['provider', 'model'] },
  affectedPackages: undefined, affectedVersionRange: undefined,
  apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: [], affectedModels: ['gpt-4.5-preview'], affectedResources: [], authOrHeaderPatterns: [], severity: 'high',
  review: { status: 'reviewed', reviewer: 'human', reviewedAt: '2026-10-05', provenance: 'official' }, evidence: [{ url: 'https://example.com/official', summary: 'Official source.', accessedAt: '2026-10-05' }],
  ...overrides,
});

describe('generic applicability scopes', () => {
  it('accepts model retirement with provider and exact model only', () => expect(() => compileProductionChangeRegistry([record()])).not.toThrow());
  it('rejects model retirement without a model scope/value', () => expect(() => compileProductionChangeRegistry([record({ applicabilityScope: { dimensions: ['provider'] }, affectedModels: [] })])).toThrow('APPLICABILITY_SCOPE_DIMENSION_REQUIRED:model'));
  it('rejects SDK method removal without package and version scope', () => expect(() => compileProductionChangeRegistry([record({ changeType: 'method_removed', applicabilityScope: { dimensions: ['provider', 'operation'] }, affectedModels: [], apiOperationPatterns: ['client.create'] })])).toThrow('APPLICABILITY_SCOPE_DIMENSION_REQUIRED:package'));
  it('accepts endpoint retirement without SDK version', () => expect(() => compileProductionChangeRegistry([record({ changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedModels: [], affectedEndpoints: ['/v1/messages'] })])).not.toThrow());
  it('accepts API-version retirement without package/version', () => expect(() => compileProductionChangeRegistry([record({ changeType: 'api_version_retired', applicabilityScope: { dimensions: ['provider', 'api_version'] }, affectedModels: [], apiVersionMetadata: { version: '2024-01-01' } })])).not.toThrow());
  it('accepts parameter removal only with operation and parameter', () => expect(() => compileProductionChangeRegistry([record({ changeType: 'parameter_removed', applicabilityScope: { dimensions: ['provider', 'operation', 'parameter'] }, affectedModels: [], apiOperationPatterns: ['messages.create'], affectedParameters: ['temperature'] })])).not.toThrow());
  it('rejects parameter removal without operation', () => expect(() => compileProductionChangeRegistry([record({ changeType: 'parameter_removed', applicabilityScope: { dimensions: ['provider', 'parameter'] }, affectedModels: [], affectedParameters: ['temperature'] })])).toThrow('APPLICABILITY_SCOPE_DIMENSION_REQUIRED:operation'));

  it('accepts the exact OpenAI model-retirement candidate scope without SDK applicability', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-gpt-4-5-preview-removal-2025-07-14');
    if (!candidate) throw new Error('OPENAI_GPT45_CANDIDATE_MISSING');
    expect(candidate?.payload.applicabilityScope).toEqual({ dimensions: ['provider', 'model'] });
    expect(candidate?.payload.affectedPackages).toBeUndefined();
    expect(() => promoteCandidateToReviewed({
      ...candidate,
      state: 'reviewed',
      auditTrail: [...(candidate?.auditTrail ?? []), { state: 'reviewed', at: '2026-10-05', actor: 'human-reviewer', note: 'Test-only local validation; not production approval.' }],
      payload: { ...candidate?.payload, severity: 'high' },
    }, { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-10-05', notes: 'Test-only local validation; do not promote automatically.' }, [{ url: candidate?.sourceUrl ?? 'https://developers.openai.com/api/docs/deprecations', summary: 'Official OpenAI source.', accessedAt: '2026-10-05' }])).not.toThrow();
  });
});
