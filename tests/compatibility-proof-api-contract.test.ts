import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('production compatibility proof API contract', () => {
  it('exposes the explicitly reviewed OpenAI record through the production registry', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('openai-gpt-4-5-preview-removal-2025-07-14')).toBe(true);
  });

  it('can only expose records sourced from the production registry', () => {
    for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
      expect(change.review.status).toBe('reviewed');
      expect(change.review.provenance).toBe('official');
    }
  });

  it('never exposes a captured review-queue candidate as a production proof record', () => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      if (candidate.candidateId === 'openai-gpt-4-5-preview-removal-2025-07-14') continue;
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(false);
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.changeId === candidate.payload.changeId)).toBe(false);
    }
  });
});
