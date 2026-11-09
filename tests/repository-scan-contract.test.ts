import { describe, expect, it } from 'vitest';
import { parseRepositoryConnectionResponse, parseRepositoryScanResponse } from '../apps/web/src/lib/repository-scan-contract.js';

describe('repository scan action response', () => {
  it('requires an explicit successful repository connection projection', () => {
    expect(parseRepositoryConnectionResponse({ success: true, repository: { id: ' repo-1 ' } })).toEqual({ repositoryId: 'repo-1' });
    expect(parseRepositoryConnectionResponse({ repository: { id: 'repo-1' } })).toBeNull();
    expect(parseRepositoryConnectionResponse({ success: true, repository: {} })).toBeNull();
  });

  it('accepts a non-negative findings count', () => {
    expect(parseRepositoryScanResponse({ success: true, result: { findingsCount: 3 } })).toEqual({ findingsCount: 3 });
  });

  it('rejects malformed or unsafe action results', () => {
    expect(parseRepositoryScanResponse({ result: {} })).toBeNull();
    expect(parseRepositoryScanResponse({ result: { findingsCount: -1 } })).toBeNull();
    expect(parseRepositoryScanResponse({ result: { findingsCount: '3' } })).toBeNull();
  });
});
