import { describe, expect, it } from 'vitest';
import { buildCandidateCompatibilityPreview } from '@apiproof/shared';
import { evaluateCompatibility } from '@apiproof/analyzers';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from '@apiproof/providers';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

describe('candidate compatibility preview', () => {
  it('labels candidate output as unreviewed and requires manual review', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.find((entry) => entry.providerId === 'openai')!;
    const result = evaluateCompatibility({ providerId: 'openai', packageName: 'openai', resolvedVersion: '4.55.0', versionSource: 'lockfile', versionConfidence: 'exact', usages: [{ id: 'u', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.9, static: true, location: { file: 'src/chat.ts', line: 12, column: 1 } }], completeEvidence: true }, COMPATIBILITY_FIXTURES[0], { compatibilityProviders: new Set(['openai']) });
    const preview = buildCandidateCompatibilityPreview(candidate, result, ['SDK package and operation scope not proven by source.']);
    expect(preview).toMatchObject({ previewKind: 'candidate-unreviewed', candidateId: candidate.candidateId, reviewStatus: 'needs_review', nextAction: 'MANUAL_REVIEW' });
  });

  it('rejects reviewed candidates from candidate preview mode', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.find((entry) => entry.providerId === 'openai')!;
    const result = evaluateCompatibility({ providerId: 'openai', usages: [], completeEvidence: true }, COMPATIBILITY_FIXTURES[0], { compatibilityProviders: new Set(['openai']) });
    expect(() => buildCandidateCompatibilityPreview({ ...candidate, state: 'reviewed', auditTrail: [...candidate.auditTrail, { state: 'reviewed', at: '2026-10-05', actor: 'reviewer', note: 'reviewed' }] }, result, ['scope'])).toThrow('CANDIDATE_PREVIEW_REQUIRES_UNREVIEWED');
  });
});
