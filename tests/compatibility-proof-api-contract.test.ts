import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('production compatibility proof API contract', () => {
  it('exposes reviewed OpenAI and Anthropic records through the production registry', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(4);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('openai-gpt-4-5-preview-removal-2025-07-14')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('openai-assistants-api-sunset-2026-08-26')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('anthropic-claude-opus-4-1-retirement-2026-08-05')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('anthropic-opus-4-7-parameter-restrictions')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
    ]);
  });

  it('can only expose records sourced from the production registry', () => {
    for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
      expect(change.review.status).toBe('reviewed');
      expect(change.review.provenance).toBe('official');
    }
  });

  it('never exposes an unreviewed captured candidate as a production proof record', () => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      if (candidate.candidateId === 'openai-gpt-4-5-preview-removal-2025-07-14' || candidate.candidateId === 'openai-assistants-api-sunset-2026-08-26' || candidate.candidateId === 'anthropic-claude-opus-4-1-retirement-2026-08-05' || candidate.candidateId === 'anthropic-opus-4-7-parameter-restrictions') continue;
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(false);
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.changeId === candidate.payload.changeId)).toBe(false);
    }
  });
});
