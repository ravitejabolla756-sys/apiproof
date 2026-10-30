import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  fingerprintCandidate,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';
import { evaluateNormalizedCompatibility, evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage, NormalizedUsageIR } from '@apiproof/shared';

const reviewInputs = {
  'twilio-regional-api-domain-removal-2026-04-28': {
    sourceFingerprint: 'c21edcc6438491332e641f4f6706ce98830d191009c326555af7bc728d7719ed', evidenceFingerprint: 'd6219d4929018c959dbd916b38773325cc8ce3a709f7ddb8d68dc5a3e838e3d6', candidateFingerprint: '6646a65d4ac5bd2ed3f549013766ed95beedd5bfc4c7b5c78ab0c4a117bb0143',
    notes: 'I verified the official Twilio changelog and approve authoritative applicability at provider + domain scope for the seven exact deprecated regional API domains. I do not assert an SDK package, SDK version, SDK method, or credential mapping.',
  },
  'twilio-studio-engagements-endpoint-deprecated': {
    sourceFingerprint: '05d8a88476bf4182c9569e42b96932d9c0036294d6da28426d28c6c0451d7a80', evidenceFingerprint: '0501efa9e9427c234e8450893c1208645f90f7fa35a6475635fb9a9196835ad6', candidateFingerprint: '699aabd98ad389d1ff0a39b8a4bfac0df78dbaf544850c96697dd88cf7abc1e7',
    notes: 'I verified the official Twilio Studio REST API documentation and approve authoritative applicability at provider + endpoint scope for the deprecated /Engagements endpoint and /Executions replacement. I do not assert an SDK package, SDK version, or additional endpoint scope.',
  },
  'supabase-management-logs-all-removal-2026-09-23': {
    sourceFingerprint: '1cd6ddf38800302ff4df662b1dc5cab8dd171a848647ad223150efc0a2fc29c8', evidenceFingerprint: 'b6f56792e51270c86280e4a8b5e619d1f871b9dc91ea0cd86379c971a2de9f23', candidateFingerprint: '39f2f68655b0713137fe5ce81101af481fd2914c78c698752e042e88466fbd4e',
    notes: 'I verified the official Supabase changelog and approve authoritative applicability at provider + endpoint scope for analytics/endpoints/logs.all only. I do not assert a package, SDK method, or version scope.',
  },
  'supabase-openapi-anon-key-access-2026-03-11': {
    sourceFingerprint: 'f8cc1c82fdef5b686930280bd95860dc7413c45a5e6d1db8edf2744a8c110f96', evidenceFingerprint: 'e162ea328b8db825a739fce6174efaa03637d86ef408ea81a173988886b7ff6c', candidateFingerprint: '33b4ebe9cdfef34571301ccfb2cd4e764fd0fe28564260c5066a8661dec2cfa5',
    notes: 'I verified the official Supabase security changelog and approve authoritative applicability at provider + endpoint + auth_or_header scope for the OpenAPI root accessed with the anon key. I do not assert a package, SDK method, version, or inferred header name.',
  },
} as const;

type OvernightId = keyof typeof reviewInputs;
const reviewProjection = (id: OvernightId) => {
  const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(id);
  if (!candidate) throw new Error(`OVERNIGHT_CANDIDATE_MISSING:${id}`);
  const input = reviewInputs[id];
  const action = { decision: 'approve-for-promotion-review' as const, reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', ...input };
  const reviewedCandidate = reviewCandidate(candidate, action);
  return {
    candidate,
    reviewedCandidate,
    record: promoteCandidateToReviewed(reviewedCandidate, {
      status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt, notes: action.notes,
      documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint, candidateFingerprint: action.candidateFingerprint,
    }, [{ url: candidate.sourceUrl, summary: candidate.payload.description, accessedAt: action.reviewedAt }]),
  };
};

const usage = (providerId: string, overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: `${providerId}-usage`, providerId, evidenceKind: 'http', confidence: 0.98, static: true,
  location: { file: `src/${providerId}.ts`, line: 12, column: 1, symbol: 'fetch' }, ...overrides,
});
const normalize = (input: CompatibilityUsage, language: NormalizedUsageIR['language'] = 'typescript') => normalizeCompatibilityUsage(input, { language });
const evaluate = (id: OvernightId, input: CompatibilityUsage) => {
  const { record } = reviewProjection(id);
  return evaluateNormalizedCompatibility({ providerId: input.providerId, usageIR: [normalize(input)], completeEvidence: true }, record, { compatibilityProviders: new Set([input.providerId]), requireOfficialProvenance: true });
};

describe('overnight real provider candidate projections', () => {
  it('keeps all four canonical candidates pending with current provenance bindings', () => {
    for (const id of Object.keys(reviewInputs) as OvernightId[]) {
      const { candidate } = reviewProjection(id);
      expect(candidate.state).toBe('needs_review');
      expect(candidate.documentFingerprint).toBe(reviewInputs[id].sourceFingerprint);
      expect(candidate.evidenceFingerprint).toBe(reviewInputs[id].evidenceFingerprint);
      expect(fingerprintCandidate(candidate)).toBe(reviewInputs[id].candidateFingerprint);
    }
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byDomain.get('api.ie1.twilio.com')?.map((entry) => entry.candidateId)).toEqual(['twilio-regional-api-domain-removal-2026-04-28']);
  });

  it('proves Twilio regional domains with boundary-safe hostname matching', () => {
    const oldDomain = 'https://api.ie1.twilio.com/v1/Messages';
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: oldDomain })).status).toBe('AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://API.IE1.TWILIO.COM/v1/Messages' })).status).toBe('AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.ie1.twilio.com:443/v1/Messages' })).status).toBe('AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.twilio.com/v1/Messages' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://evil.api.ie1.twilio.com.example.com/v1/Messages' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.ie1.twilio.com@evil.example.com/v1/Messages' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: undefined, static: false, confidence: 0.4 })).status).toBe('NEEDS_REVIEW');
  });

  it('proves the inserted Twilio rule through the actual registry and keeps hostname identity authoritative', () => {
    const evaluateRegisteredTwilio = (endpoint: string | undefined, overrides: Partial<CompatibilityUsage> = {}) => {
      const results = evaluateRegisteredNormalizedCompatibility({
        providerId: 'twilio', usageIR: [normalize(usage('twilio', { endpoint, ...overrides }))], completeEvidence: endpoint !== undefined,
      }, PRODUCTION_COMPATIBILITY_REGISTRY);
      return results.find((result) => result.changeId === 'twilio-regional-api-domain-removal-2026-04-28');
    };
    for (const domain of ['api.ie1.twilio.com', 'api.au1.twilio.com', 'api.br1.twilio.com', 'api.de1.twilio.com', 'api.jp1.twilio.com', 'api.sg1.twilio.com', 'api.us2.twilio.com']) {
      expect(evaluateRegisteredTwilio(`https://${domain}/path`)?.status).toBe('AFFECTED');
    }
    expect(evaluateRegisteredTwilio('https://api.twilio.com/path')?.status).toBe('NOT_AFFECTED');
    expect(evaluateRegisteredTwilio(undefined, { static: false, confidence: 0.4 })?.status).toBe('NEEDS_REVIEW');
    expect(evaluateRegisteredTwilio('https://api.twilio.com/path/api.ie1.twilio.com')?.status).toBe('NOT_AFFECTED');
    expect(evaluateRegisteredTwilio('https://api.twilio.com/path?next=api.ie1.twilio.com')?.status).toBe('NOT_AFFECTED');
    expect(evaluateRegisteredTwilio('https://api.twilio.com/path#api.ie1.twilio.com')?.status).toBe('NOT_AFFECTED');
  });

  it('proves Twilio Studio Engagements endpoint behavior', () => {
    expect(evaluate('twilio-studio-engagements-endpoint-deprecated', usage('twilio', { endpoint: '/Engagements' })).status).toBe('AFFECTED');
    expect(evaluate('twilio-studio-engagements-endpoint-deprecated', usage('twilio', { endpoint: '/Executions' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('twilio-studio-engagements-endpoint-deprecated', usage('twilio', { endpoint: undefined, static: false, confidence: 0.4 })).status).toBe('NEEDS_REVIEW');
  });

  it('proves Supabase logs.all removal and replacement behavior', () => {
    expect(evaluate('supabase-management-logs-all-removal-2026-09-23', usage('supabase', { endpoint: 'analytics/endpoints/logs.all' })).status).toBe('AFFECTED');
    expect(evaluate('supabase-management-logs-all-removal-2026-09-23', usage('supabase', { endpoint: 'analytics/endpoints/logs' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('supabase-management-logs-all-removal-2026-09-23', usage('supabase', { endpoint: undefined, static: false, confidence: 0.4 })).status).toBe('NEEDS_REVIEW');
  });

  it('keeps Supabase logs.all endpoint matching exact and fail-closed', () => {
    const id = 'supabase-management-logs-all-removal-2026-09-23' as const;
    for (const endpoint of ['analytics/endpoints/logs.all.extra', 'prefix-logs.all', 'analytics/endpoints/logs?next=logs.all', 'analytics/endpoints/other/logs.all']) {
      expect(evaluate(id, usage('supabase', { endpoint })).status).toBe('NOT_AFFECTED');
    }
    const reviewed = reviewProjection(id);
    expect(reviewed.candidate.state).toBe('needs_review');
    expect(reviewed.reviewedCandidate.state).toBe('reviewed');
    expect(reviewed.record.evidence.some((source) => source.summary.includes('ClickHouse SQL'))).toBe(true);
  });

  it('proves Supabase OpenAPI anon-key restriction with auth uncertainty', () => {
    const endpoint = '/rest/v1/';
    const affected = evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint, authOrHeader: 'anon key' }));
    expect(affected.status).toBe('AFFECTED');
    expect(evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint, authOrHeader: 'service-role key' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint, authOrHeader: 'new fixture API key' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint: '/rest/v1/users', authOrHeader: 'anon key' })).status).toBe('NOT_AFFECTED');
    const dynamic = evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint, authOrHeader: undefined, static: false, confidence: 0.4 }));
    expect(dynamic.status).toBe('NEEDS_REVIEW');
    expect(dynamic.reasonCodes).toContain('AUTH_OR_HEADER_UNRESOLVED');
    const unresolvedEndpoint = evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint: undefined, authOrHeader: 'anon key', static: false, confidence: 0.4 }));
    expect(unresolvedEndpoint.status).toBe('NEEDS_REVIEW');
    expect(unresolvedEndpoint.reasonCodes).toContain('ENDPOINT_UNRESOLVED');
    const projection = reviewProjection('supabase-openapi-anon-key-access-2026-03-11');
    expect(projection.candidate.state).toBe('needs_review');
    expect(projection.reviewedCandidate.state).toBe('reviewed');
    expect(projection.record).toMatchObject({
      effectiveAt: '2026-03-11',
      applicabilityScope: { dimensions: ['provider', 'endpoint', 'auth_or_header'] },
      affectedEndpoints: ['/rest/v1/'],
      authOrHeaderPatterns: ['anon key'],
      review: {
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-06',
        documentFingerprint: 'f8cc1c82fdef5b686930280bd95860dc7413c45a5e6d1db8edf2744a8c110f96',
        evidenceFingerprint: 'e162ea328b8db825a739fce6174efaa03637d86ef408ea81a173988886b7ff6c',
        candidateFingerprint: '33b4ebe9cdfef34571301ccfb2cd4e764fd0fe28564260c5066a8661dec2cfa5',
      },
    });
    expect(projection.candidate.sourceEvidence!.claims).toEqual(expect.arrayContaining([
      { key: 'publishedAt', value: '2026-02-17' },
      { key: 'deprecationStart', value: '2026-03-11' },
      { key: 'rollout', value: 'Existing projects blocked April 8, 2026' },
    ]));
    expect(projection.record.authOrHeaderPatterns).not.toContain('Authorization');
    const proofResults = [affected, evaluate('supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint, authOrHeader: 'service-role key' })), dynamic];
    const proofs = proofResults.flatMap((result, index) => buildCompatibilityProofSnapshot({ repositoryId: 'supabase-openapi-fixture', baselineSha: 'a'.repeat(40), scanId: `supabase-openapi-proof-${index}`, results: [result], mode: 'test' }));
    expect(proofs.map((proof) => proof.status).sort()).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
    expect(proofs.find((proof) => proof.status === 'AFFECTED')).toMatchObject({ providerId: 'supabase', changeId: 'supabase-openapi-anon-key-access-2026-03-11', severity: 'high', reviewStatus: 'reviewed', provenance: 'official' });
  });

  it.each(['typescript', 'python'] as const)('preserves domain and auth semantics in %s normalized IR', (language) => {
    const regional = evaluateNormalizedCompatibility({ providerId: 'twilio', usageIR: [normalize(usage('twilio', { endpoint: 'https://api.ie1.twilio.com/v1/Messages' }), language)], completeEvidence: true }, reviewProjection('twilio-regional-api-domain-removal-2026-04-28').record, { compatibilityProviders: new Set(['twilio']), requireOfficialProvenance: true });
    const studio = evaluateNormalizedCompatibility({ providerId: 'twilio', usageIR: [normalize(usage('twilio', { endpoint: '/Engagements' }), language)], completeEvidence: true }, reviewProjection('twilio-studio-engagements-endpoint-deprecated').record, { compatibilityProviders: new Set(['twilio']), requireOfficialProvenance: true });
    const logs = evaluateNormalizedCompatibility({ providerId: 'supabase', usageIR: [normalize(usage('supabase', { endpoint: 'analytics/endpoints/logs.all' }), language)], completeEvidence: true }, reviewProjection('supabase-management-logs-all-removal-2026-09-23').record, { compatibilityProviders: new Set(['supabase']), requireOfficialProvenance: true });
    const auth = evaluateNormalizedCompatibility({ providerId: 'supabase', usageIR: [normalize(usage('supabase', { endpoint: '/rest/v1/', authOrHeader: 'anon key' }), language)], completeEvidence: true }, reviewProjection('supabase-openapi-anon-key-access-2026-03-11').record, { compatibilityProviders: new Set(['supabase']), requireOfficialProvenance: true });
    expect(regional.status).toBe('AFFECTED');
    expect(studio.status).toBe('AFFECTED');
    expect(logs.status).toBe('AFFECTED');
    expect(auth.status).toBe('AFFECTED');
  });

  it('generates official-source proof snapshots and preserves the seven-rule production registry', () => {
    const affected = evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.ie1.twilio.com/v1/Messages' }));
    const notAffected = evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.twilio.com/v1/Messages' }));
    const needsReview = evaluate('twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: undefined, static: false, confidence: 0.4 }));
    const proofs = [affected, notAffected, needsReview].flatMap((result, index) => buildCompatibilityProofSnapshot({ repositoryId: 'overnight-provider-fixture', baselineSha: 'b'.repeat(40), scanId: `overnight-proof-${index}`, results: [result], mode: 'test' }));
    expect(proofs.map((proof) => proof.status).sort()).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
    expect(proofs.find((proof) => proof.status === 'AFFECTED')).toMatchObject({ providerId: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', severity: 'high', reviewStatus: 'reviewed', provenance: 'official', replacement: { domain: 'api.twilio.com' } });
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(50);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(3);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('github')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('twilio')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('supabase')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('twilio-regional-api-domain-removal-2026-04-28')).toBe(true);
  });

  it('generates affected, unaffected, and uncertain proof snapshots for every overnight projection', () => {
    const scenarios: Array<[OvernightId, CompatibilityUsage, CompatibilityUsage, CompatibilityUsage]> = [
      ['twilio-regional-api-domain-removal-2026-04-28', usage('twilio', { endpoint: 'https://api.ie1.twilio.com/v1/Messages' }), usage('twilio', { endpoint: 'https://api.twilio.com/v1/Messages' }), usage('twilio', { endpoint: undefined, static: false, confidence: 0.4 })],
      ['twilio-studio-engagements-endpoint-deprecated', usage('twilio', { endpoint: '/Engagements' }), usage('twilio', { endpoint: '/Executions' }), usage('twilio', { endpoint: undefined, static: false, confidence: 0.4 })],
      ['supabase-management-logs-all-removal-2026-09-23', usage('supabase', { endpoint: 'analytics/endpoints/logs.all' }), usage('supabase', { endpoint: 'analytics/endpoints/logs' }), usage('supabase', { endpoint: undefined, static: false, confidence: 0.4 })],
      ['supabase-openapi-anon-key-access-2026-03-11', usage('supabase', { endpoint: '/rest/v1/', authOrHeader: 'anon key' }), usage('supabase', { endpoint: '/rest/v1/', authOrHeader: 'fixture API key' }), usage('supabase', { endpoint: '/rest/v1/', authOrHeader: undefined, static: false, confidence: 0.4 })],
    ];
    for (const [id, affectedUsage, unaffectedUsage, uncertainUsage] of scenarios) {
      const affected = evaluate(id, affectedUsage);
      const unaffected = evaluate(id, unaffectedUsage);
      const uncertain = evaluate(id, uncertainUsage);
      const proofs = [affected, unaffected, uncertain].flatMap((result, index) => buildCompatibilityProofSnapshot({ repositoryId: `overnight-${id}`, baselineSha: 'c'.repeat(40), scanId: `${id}-${index}`, results: [result], mode: 'test' }));
      expect(proofs.map((proof) => proof.status).sort(), id).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
      expect(proofs.every((proof) => proof.provenance === 'official' && proof.reviewStatus === 'reviewed' && proof.severity === 'high'), id).toBe(true);
    }
  });

  it('does not produce cross-provider claims', () => {
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [normalize(usage('openai', { endpoint: 'https://api.ie1.twilio.com/v1/Messages' }))], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(results.every((result) => result.providerId === 'openai')).toBe(true);
    expect(results.some((result) => result.changeId === 'twilio-regional-api-domain-removal-2026-04-28')).toBe(false);
  });
});
