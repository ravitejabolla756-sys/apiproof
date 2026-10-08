import { describe, expect, it } from 'vitest';
import type { CompatibilityUsage } from '@apiproof/shared';
import { evaluateCompatibility, evaluateRegisteredCompatibility } from '@apiproof/analyzers';
import {
  EXPANSION_OFFICIAL_CHANGE_CANDIDATES,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  promoteCandidateToReviewed,
} from '@apiproof/providers';
import {
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE,
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW,
} from '../packages/providers/src/local-reviewed-candidate-reviews.js';

const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'slack-files-upload-removal-2025-11-12');
if (!candidate) throw new Error('SLACK_FILES_UPLOAD_CANDIDATE_MISSING');

const reviewedRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE,
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW,
  [{ url: candidate.sourceUrl, summary: 'Slack documents the files.upload retirement and sequenced replacement methods.', accessedAt: '2026-10-08' }],
);

const policy = { compatibilityProviders: new Set(['slack']), requireOfficialProvenance: true };
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'slack-upload', providerId: 'slack', operation: 'files.upload', evidenceKind: 'sdk', confidence: 1, static: true,
  location: { file: 'src/upload.ts', line: 18, column: 3, symbol: 'client.files.upload' }, ...overrides,
});

describe('Slack files.upload human review', () => {
  it('reviews a separate copy while the canonical candidate remains needs_review', () => {
    expect(candidate.state).toBe('needs_review');
    expect(LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE.state).toBe('reviewed');
    expect(LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed', actor: 'Ravi Teja', at: '2026-10-08',
      reviewBinding: {
        documentFingerprint: '24840b8e5e4d093c41b747ba459cfb13444201061a6b1f3040df75da433cdd5f',
        evidenceFingerprint: '7bcaa779622bea78c632c52a2296c7c41bd7aa373887a784866743e501f3b6e9',
        candidateFingerprint: '2d53d350d578f37984e7a579512ecc9ea9512fdc006733000cd05e7ff2883372',
      },
    });
    expect(LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW).toMatchObject({ status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human' });
    expect(reviewedRecord.applicabilityScope).toEqual({ dimensions: ['provider', 'operation'] });
    expect(reviewedRecord.severity).toBe('high');
    expect(reviewedRecord.review).toMatchObject({ status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official' });
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.affectedVersionRange).toBeUndefined();
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('slack')).toHaveLength(1);
  });

  it('evaluates the reviewed projection without cross-provider claims', () => {
    expect(evaluateCompatibility({ providerId: 'slack', usages: [usage()], completeEvidence: true }, reviewedRecord, policy).status).toBe('AFFECTED');
    expect(evaluateCompatibility({ providerId: 'slack', usages: [usage({ operation: 'files.getUploadURLExternal' })], completeEvidence: true }, reviewedRecord, policy).status).toBe('NOT_AFFECTED');
    expect(evaluateCompatibility({ providerId: 'slack', usages: [usage({ operation: 'files.completeUploadExternal' })], completeEvidence: true }, reviewedRecord, policy).status).toBe('NOT_AFFECTED');
    expect(evaluateCompatibility({ providerId: 'slack', usages: [usage({ operation: undefined, static: false, confidence: 0.4 })], completeEvidence: false }, reviewedRecord, policy).status).toBe('NEEDS_REVIEW');
    expect(evaluateCompatibility({ providerId: 'openai', usages: [usage({ providerId: 'openai', operation: 'responses.create' })], completeEvidence: true }, reviewedRecord, { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true }).status).not.toBe('AFFECTED');
  });

  it('evaluates the actual local production registry for Slack', () => {
    const evaluate = (input: CompatibilityUsage, completeEvidence = true) => evaluateRegisteredCompatibility(
      { providerId: input.providerId, usages: [input], completeEvidence },
      PRODUCTION_COMPATIBILITY_REGISTRY,
      'slack-files-upload-removal-2025-11-12',
    );
    expect(evaluate(usage()).status).toBe('AFFECTED');
    expect(evaluate(usage({ operation: 'files.getUploadURLExternal' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ operation: 'files.completeUploadExternal' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ operation: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ operation: 'chat.postMessage' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ providerId: 'openai', operation: 'responses.create' })).status).not.toBe('AFFECTED');
  });
});
