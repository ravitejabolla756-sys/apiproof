import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('production compatibility proof API contract', () => {
  it('has no production claims while the reviewed registry is empty', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(0);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.size).toBe(0);
  });

  it('can only expose records sourced from the production registry', () => {
    for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
      expect(change.review.status).toBe('reviewed');
      expect(change.review.provenance).toBe('official');
    }
  });

  it('never exposes a captured review-queue candidate as a production proof record', () => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(false);
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.changeId === candidate.payload.changeId)).toBe(false);
    }
  });
});
