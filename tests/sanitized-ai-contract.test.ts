import { describe, expect, it } from 'vitest';
import { validateSanitizedAiEvidence } from '@apiproof/shared';

const valid = {
  provider: 'openai',
  changeId: 'openai-gpt-4-5-preview-removal-2025-07-14',
  model: 'gpt-4.5-preview',
  reasonCodes: ['MODEL_MATCH'],
  compatibilityStatus: 'AFFECTED' as const,
};

describe('sanitized AI evidence contract', () => {
  it('accepts bounded advisory evidence without source content', () => {
    expect(validateSanitizedAiEvidence(valid)).toEqual(valid);
  });

  it('rejects source bodies, secret-bearing fields, and unknown fields', () => {
    expect(() => validateSanitizedAiEvidence({ ...valid, content: 'repository source' })).toThrow();
    expect(() => validateSanitizedAiEvidence({ ...valid, token: 'secret' })).toThrow();
    expect(() => validateSanitizedAiEvidence({ ...valid, extra: 'not in contract' })).toThrow();
  });
});
