import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl, toSafeNavigationUrl } from '../apps/web/src/lib/external-link-contract.js';

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

  it('keeps navigation on a same-origin path or safe HTTPS destination', () => {
    expect(toSafeNavigationUrl('/dashboard/settings?github=connected')).toBe('/dashboard/settings?github=connected');
    expect(toSafeNavigationUrl('https://github.com/apps/apiproof/installations/new')).toBe('https://github.com/apps/apiproof/installations/new');
    expect(toSafeNavigationUrl('//evil.example.test/redirect')).toBeNull();
    expect(toSafeNavigationUrl('javascript:alert(1)')).toBeNull();
  });
});
