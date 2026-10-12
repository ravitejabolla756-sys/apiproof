import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, exportCandidateBundle, importCandidateBundle } from '@apiproof/providers';

describe('candidate bundle handoff', () => {
  it('exports and imports a stable candidate review bundle', () => {
    const first = exportCandidateBundle(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates);
    const second = exportCandidateBundle([...OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates].reverse());
    expect(first).toBe(second);
    expect(importCandidateBundle(first).candidates).toHaveLength(64);
    expect(importCandidateBundle(first).byCandidateId.get('openai-assistants-api-sunset-2026-08-26')?.state).toBe('needs_review');
  });

  it('rejects malformed bundles without touching production records', () => {
    expect(() => importCandidateBundle('{bad')).toThrow('CANDIDATE_BUNDLE_INVALID_JSON');
    expect(() => importCandidateBundle('{"schemaVersion":2,"candidates":[]}')).toThrow('CANDIDATE_BUNDLE_INVALID_SCHEMA');
  });
});
