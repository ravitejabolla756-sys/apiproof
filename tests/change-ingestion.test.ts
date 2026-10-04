import { describe, expect, it } from 'vitest';
import { compileProductionChangeRegistry, compileCandidateChangeRegistry, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, promoteCandidateToReviewed, sourceHasUpdated } from '@apiproof/providers';
import { fingerprintOfficialSource } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const candidate = (overrides: Record<string, unknown> = {}) => ({
  candidateId: 'candidate-openai-1', providerId: 'openai', sourceUrl: 'https://platform.openai.com/docs', sourceType: 'official-documentation',
  sourceFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', discoveredAt: '2026-01-01', state: 'needs_review',
  payload: { changeId: 'candidate-openai-1', title: COMPATIBILITY_FIXTURES[0]!.title, description: COMPATIBILITY_FIXTURES[0]!.description, changeType: COMPATIBILITY_FIXTURES[0]!.changeType, affectedPackages: [...COMPATIBILITY_FIXTURES[0]!.affectedPackages], affectedVersionRange: COMPATIBILITY_FIXTURES[0]!.affectedVersionRange, apiOperationPatterns: [...COMPATIBILITY_FIXTURES[0]!.apiOperationPatterns], affectedParameters: [...COMPATIBILITY_FIXTURES[0]!.affectedParameters], affectedResponseFields: [...COMPATIBILITY_FIXTURES[0]!.affectedResponseFields], affectedEndpoints: [...COMPATIBILITY_FIXTURES[0]!.affectedEndpoints], affectedModels: [...COMPATIBILITY_FIXTURES[0]!.affectedModels], severity: COMPATIBILITY_FIXTURES[0]!.severity },
  auditTrail: [
    { state: 'discovered', at: '2026-01-01', actor: 'source-adapter', note: 'Candidate captured from an official source.' },
    { state: 'normalized', at: '2026-01-01', actor: 'candidate-normalizer', note: 'Candidate facts normalized.' },
    { state: 'needs_review', at: '2026-01-01', actor: 'candidate-normalizer', note: 'Human review required.' },
  ],
  ...overrides,
});

describe('candidate change ingestion', () => {
  it('fingerprints an exact official source snapshot, ignoring URL fragments only', () => {
    const source = { sourceUrl: 'https://example.com/changelog#entry', sourceType: 'official-changelog' as const, fetchedAt: '2026-01-01', content: 'official source body' };
    expect(fingerprintOfficialSource(source)).toBe(fingerprintOfficialSource({ ...source, sourceUrl: 'https://example.com/changelog#different-entry' }));
    expect(fingerprintOfficialSource(source)).not.toBe(fingerprintOfficialSource({ ...source, content: 'updated official source body' }));
    expect(fingerprintOfficialSource(source)).not.toBe(fingerprintOfficialSource({ ...source, sourceUrl: 'https://example.com/other-changelog' }));
  });

  it('keeps candidates separate from production records and indexes them deterministically', () => {
    const registry = compileCandidateChangeRegistry([candidate()]);
    expect(registry.candidates).toHaveLength(1);
    expect(registry.byCandidateId.get('candidate-openai-1')?.state).toBe('needs_review');
    expect(registry.bySourceFingerprint.has('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(registry.byProvider.get('openai')).toHaveLength(1);
    expect(registry.byPackage.get('openai')).toHaveLength(1);
    expect(registry.byOperation.get('chat.completions.create')).toHaveLength(1);
    expect(registry.byProposedChangeId.get('candidate-openai-1')).toHaveLength(1);
    expect(() => compileProductionChangeRegistry(registry.candidates)).toThrow();
  });

  it('groups corroborating sources by proposed production change ID without merging them', () => {
    const corroborating = candidate({
      candidateId: 'candidate-openai-2', sourceUrl: 'https://platform.openai.com/changelog',
      sourceFingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      state: 'discovered',
      auditTrail: [{ state: 'discovered', at: '2026-01-01', actor: 'source-adapter', note: 'Corroborating official source captured.' }],
    });
    const registry = compileCandidateChangeRegistry([corroborating, candidate()]);
    expect(registry.byProposedChangeId.get('candidate-openai-1')?.map((item) => item.candidateId)).toEqual(['candidate-openai-1', 'candidate-openai-2']);
    expect(registry.byCandidateId.size).toBe(2);
  });

  it('keeps captured official candidates in the review queue, never the production registry', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26');
    expect(candidate).toMatchObject({ providerId: 'openai', state: 'needs_review', sourceType: 'deprecation-notice' });
    expect(candidate?.payload.removalAt).toBe('2026-08-26');
    expect(candidate?.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(() => compileProductionChangeRegistry(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates)).toThrow();
  });

  it('rejects duplicate candidates and unknown providers', () => {
    expect(() => compileCandidateChangeRegistry([candidate(), candidate({ candidateId: 'candidate-openai-1b', sourceFingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })])).not.toThrow();
    expect(() => compileCandidateChangeRegistry([candidate(), candidate()])).toThrow('CANDIDATE_DUPLICATE_ID');
    expect(() => compileCandidateChangeRegistry([candidate({ providerId: 'not-a-provider' })])).toThrow('CANDIDATE_UNKNOWN_PROVIDER');
  });

  it('rejects candidates whose audit trail does not prove the declared lifecycle state', () => {
    expect(() => compileCandidateChangeRegistry([candidate({ auditTrail: [{ state: 'discovered', at: '2026-01-01', actor: 'source-adapter', note: 'Capture only.' }] })])).toThrow('CANDIDATE_AUDIT_STATE_MISMATCH');
    expect(() => compileCandidateChangeRegistry([candidate({ auditTrail: [...candidate().auditTrail, { state: 'needs_review', at: '2025-12-31', actor: 'candidate-normalizer', note: 'Invalid timeline.' }] })])).toThrow('CANDIDATE_AUDIT_DATE_INVALID');
    expect(() => compileCandidateChangeRegistry([candidate({ state: 'reviewed', auditTrail: [candidate().auditTrail[0]!, { state: 'reviewed', at: '2026-01-02', actor: 'human-reviewer', note: 'Invalid direct review.' }] })])).toThrow('CANDIDATE_AUDIT_TRANSITION_INVALID');
  });

  it('detects source updates by fingerprint without treating them as new intelligence', () => {
    const previous = candidate({ state: 'normalized', auditTrail: candidate().auditTrail.slice(0, 2) });
    const incoming = candidate({ state: 'discovered', sourceFingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', auditTrail: candidate().auditTrail.slice(0, 1) });
    expect(sourceHasUpdated(previous as never, incoming as never)).toBe(true);
    expect(sourceHasUpdated(previous as never, candidate({ candidateId: 'different-candidate', sourceFingerprint: incoming.sourceFingerprint, state: 'discovered', auditTrail: incoming.auditTrail }) as never)).toBe(false);
    expect(sourceHasUpdated(previous as never, candidate({ sourceUrl: 'https://platform.openai.com/changelog', sourceFingerprint: incoming.sourceFingerprint, state: 'discovered', auditTrail: incoming.auditTrail }) as never)).toBe(false);
  });

  it('requires a source update to return through review before promotion', () => {
    const previous = candidate({
      state: 'reviewed',
      auditTrail: [...candidate().auditTrail, { state: 'reviewed', at: '2026-01-02', actor: 'human-reviewer', note: 'Human review completed.' }],
    });
    const updated = candidate({
      candidateId: 'candidate-openai-1-source-update',
      sourceFingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      state: 'discovered',
      auditTrail: [{ state: 'discovered', at: '2026-01-03', actor: 'source-adapter', note: 'Updated official source captured.' }],
    });
    expect(sourceHasUpdated(previous as never, candidate({ ...updated, candidateId: previous.candidateId }) as never)).toBe(true);
    expect(() => promoteCandidateToReviewed(updated, { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-03', notes: 'Stale review must not carry forward.' }, [{ url: updated.sourceUrl, summary: 'Updated official source.', accessedAt: '2026-01-03' }])).toThrow('CANDIDATE_NOT_READY_FOR_PROMOTION');
  });

  it('promotes only reviewed complete candidates with source evidence', () => {
    const reviewed = candidate({ state: 'reviewed', auditTrail: [...candidate().auditTrail, { state: 'reviewed', at: '2026-01-02', actor: 'human-reviewer', note: 'Human review completed.' }] });
    const record = promoteCandidateToReviewed(reviewed, { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-02', notes: 'Reviewed against the official source.' }, [{ url: 'https://platform.openai.com/docs', summary: 'Official source reference.', accessedAt: '2026-01-02' }]);
    expect(record.review.status).toBe('reviewed');
    expect(record.review.provenance).toBe('official');
    expect(compileProductionChangeRegistry([record]).byChangeId.has(record.changeId)).toBe(true);
  });

  it('refuses promotion before review, without source evidence, or with an invalid range', () => {
    expect(() => promoteCandidateToReviewed(candidate(), { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-02', notes: 'Reviewed.' }, [])).toThrow('CANDIDATE_NOT_READY_FOR_PROMOTION');
    const reviewedAudit = { state: 'reviewed', at: '2026-01-02', actor: 'human-reviewer', note: 'Human review completed.' } as const;
    expect(() => promoteCandidateToReviewed(candidate({ state: 'reviewed', auditTrail: [...candidate().auditTrail, reviewedAudit] }), { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-02', notes: 'Reviewed.' }, [])).toThrow('CANDIDATE_SOURCE_NOT_IN_EVIDENCE');
    expect(() => promoteCandidateToReviewed(candidate({ state: 'reviewed', auditTrail: [...candidate().auditTrail, reviewedAudit], payload: { ...candidate().payload, affectedVersionRange: 'invalid' } }), { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-02', notes: 'Reviewed.' }, [{ url: 'https://platform.openai.com/docs', summary: 'Official source reference.', accessedAt: '2026-01-02' }])).toThrow('CANDIDATE_INVALID_VERSION_RANGE');
  });

  it('refuses agent-only review from entering the production registry', () => {
    const reviewed = candidate({ state: 'reviewed', auditTrail: [...candidate().auditTrail, { state: 'reviewed', at: '2026-01-02', actor: 'agent', note: 'Automated review completed.' }] });
    expect(() => promoteCandidateToReviewed(reviewed, { status: 'reviewed', reviewer: 'Automated reviewer', reviewerKind: 'agent', reviewedAt: '2026-01-02', notes: 'Automated review.' }, [{ url: 'https://platform.openai.com/docs', summary: 'Official source reference.', accessedAt: '2026-01-02' }])).toThrow('CANDIDATE_HUMAN_REVIEW_REQUIRED');
  });

  it('allows a human-reviewed API-level candidate without an SDK-version constraint', () => {
    const reviewedAudit = { state: 'reviewed', at: '2026-01-02', actor: 'human-reviewer', note: 'Human review completed.' } as const;
    const reviewed = candidate({
      state: 'reviewed', auditTrail: [...candidate().auditTrail, reviewedAudit],
      payload: { ...candidate().payload, affectedVersionRange: undefined, changeType: 'endpoint_removed', apiOperationPatterns: ['beta.assistants'], affectedParameters: [] },
    });
    const record = promoteCandidateToReviewed(reviewed, { status: 'reviewed', reviewer: 'Human reviewer', reviewerKind: 'human', reviewedAt: '2026-01-02', notes: 'Reviewed against the official source.' }, [{ url: 'https://platform.openai.com/docs', summary: 'Official source reference.', accessedAt: '2026-01-02' }]);
    expect(record.affectedVersionRange).toBeUndefined();
    expect(compileProductionChangeRegistry([record]).byChangeId.has(record.changeId)).toBe(true);
  });
});
