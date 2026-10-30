import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PROVIDER_EXPANSION_BATCH7_CANDIDATES,
  PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS,
} from '@apiproof/providers';

describe('provider intelligence expansion batch 7', () => {
  it('keeps all five source-backed candidates in the canonical review queue', () => {
    expect(PROVIDER_EXPANSION_BATCH7_CANDIDATES).toHaveLength(5);
    expect(PROVIDER_EXPANSION_BATCH7_CANDIDATES.every((candidate) => candidate.state === 'needs_review')).toBe(true);
    expect(PROVIDER_EXPANSION_BATCH7_CANDIDATES.every((candidate) => candidate.documentFingerprint?.length === 64)).toBe(true);
    expect(PROVIDER_EXPANSION_BATCH7_CANDIDATES.every((candidate) => candidate.sourceEvidence?.sourceTitle)).toBeTruthy();
    expect([...OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates]).toEqual(expect.arrayContaining([...PROVIDER_EXPANSION_BATCH7_CANDIDATES]));
  });

  it('promotes only fingerprint-matched human-reviewed projections', () => {
    expect(PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS).toHaveLength(5);
    expect(PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS.every((record) => record.review.status === 'reviewed')).toBe(true);
    expect(PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS.every((record) => record.review.reviewer === 'Ravi Teja')).toBe(true);
    expect(new Set(PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS.map((record) => record.providerId))).toEqual(new Set(['elevenlabs', 'clerk', 'groq', 'firebase', 'google-cloud']));
    expect(PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS.every((record) => record.evidence.length > 0)).toBe(true);
  });
});
