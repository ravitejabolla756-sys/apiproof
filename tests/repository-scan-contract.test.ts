import { describe, expect, it } from 'vitest';
import { parseRepositoryScanResponse } from '../apps/web/src/lib/repository-scan-contract.js';

describe('repository scan action response', () => {
  it('accepts a non-negative findings count', () => {
    expect(parseRepositoryScanResponse({ success: true, result: { findingsCount: 3 } })).toEqual({ findingsCount: 3 });
  });

  it('rejects malformed or unsafe action results', () => {
    expect(parseRepositoryScanResponse({ result: {} })).toBeNull();
    expect(parseRepositoryScanResponse({ result: { findingsCount: -1 } })).toBeNull();
    expect(parseRepositoryScanResponse({ result: { findingsCount: '3' } })).toBeNull();
  });
});
