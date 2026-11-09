import { describe, expect, it } from 'vitest';
import { parseCompatibilityProofResponse } from '../apps/web/src/lib/compatibility-proof-contract.js';

const change = {
  providerId: 'fixture', changeId: 'change-1', title: 'Removed field', changeType: 'response-field-removed', officialSourceUrl: 'https://example.test/change',
  publishedAt: null, effectiveAt: null, removalAt: null, severity: 'high', applicabilityScope: { dimensions: ['model'] }, affectedModels: ['Model'], affectedResources: [],
  affectedResponseFields: ['field'], affectedEndpoints: [], affectedDomains: [], authOrHeaderPatterns: [], affectedParameters: [], replacement: null, reviewer: 'reviewer', reviewedAt: '2026-11-08T00:00:00.000Z',
};

describe('compatibility proof response contract', () => {
  it('normalizes a valid reviewed change projection', () => {
    expect(parseCompatibilityProofResponse({ claimsAvailable: true, reason: null, changes: [{ ...change, title: ' Removed field ' }] })).toMatchObject({ changes: [{ title: 'Removed field' }] });
  });

  it('rejects malformed nested scopes and duplicate change IDs', () => {
    expect(parseCompatibilityProofResponse({ claimsAvailable: true, reason: null, changes: [{ ...change, applicabilityScope: { dimensions: [4] } }] })).toBeNull();
    expect(parseCompatibilityProofResponse({ claimsAvailable: true, reason: null, changes: [change, change] })).toBeNull();
  });
});
