import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PROVIDER_EXPANSION_BATCH8_CANDIDATES, PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS } from '@apiproof/providers';

describe('provider intelligence expansion batch 8', () => {
  it('keeps the five bounded official candidates in needs_review', () => {
    expect(PROVIDER_EXPANSION_BATCH8_CANDIDATES).toHaveLength(5);
    expect(PROVIDER_EXPANSION_BATCH8_CANDIDATES.every((candidate) => candidate.state === 'needs_review')).toBe(true);
    expect(PROVIDER_EXPANSION_BATCH8_CANDIDATES.every((candidate) => candidate.documentFingerprint?.length === 64)).toBe(true);
    expect([...OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates]).toEqual(expect.arrayContaining([...PROVIDER_EXPANSION_BATCH8_CANDIDATES]));
  });

  it('promotes only the bounded source facts with human review provenance', () => {
    expect(PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS).toHaveLength(5);
    expect(PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS.every((record) => record.review.status === 'reviewed' && record.review.reviewer === 'Ravi Teja')).toBe(true);
    expect(PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS.every((record) => record.evidence.length > 0)).toBe(true);
    expect(new Set(PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS.map((record) => record.providerId))).toEqual(new Set(['stripe', 'slack', 'openai', 'cloudflare']));
  });
});
