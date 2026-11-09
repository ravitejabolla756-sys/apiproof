import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl } from '../apps/web/src/lib/external-link-contract.js';

describe('external link boundary', () => {
  it('accepts absolute credential-free HTTPS URLs', () => {
    expect(toSafeExternalUrl('https://docs.example.test/changelog')).toBe('https://docs.example.test/changelog');
  });

  it('rejects non-HTTPS, relative and credential-bearing URLs', () => {
    expect(toSafeExternalUrl('http://docs.example.test/changelog')).toBeNull();
    expect(toSafeExternalUrl('/dashboard')).toBeNull();
    expect(toSafeExternalUrl('https://user:secret@docs.example.test/changelog')).toBeNull();
    expect(toSafeExternalUrl('javascript:alert(1)')).toBeNull();
  });
});
