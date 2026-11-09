import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl, toSafeInvitationUrl, toSafeNavigationUrl } from '../apps/web/src/lib/external-link-contract.js';

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

  it('only accepts same-origin invitation links with a token', () => {
    expect(toSafeInvitationUrl('/invite/accept?token=fixture-token', 'http://localhost:3225')).toBe('http://localhost:3225/invite/accept?token=fixture-token');
    expect(toSafeInvitationUrl('http://127.0.0.1:3225/invite/accept?token=fixture-token', 'http://localhost:3225')).toBe('http://127.0.0.1:3225/invite/accept?token=fixture-token');
    expect(toSafeInvitationUrl('https://evil.example.test/invite/accept?token=fixture-token', 'http://localhost:3225')).toBeNull();
    expect(toSafeInvitationUrl('/invite/accept', 'http://localhost:3225')).toBeNull();
    expect(toSafeInvitationUrl('/invite/accept?token=%20%20', 'http://localhost:3225')).toBeNull();
    expect(toSafeInvitationUrl('/invite/accept?token=first&token=second', 'http://localhost:3225')).toBeNull();
    expect(toSafeInvitationUrl('javascript:alert(1)', 'http://localhost:3225')).toBeNull();
  });
});
