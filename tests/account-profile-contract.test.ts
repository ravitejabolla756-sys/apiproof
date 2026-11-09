import { describe, expect, it } from 'vitest';
import { parseAccountProfileResponse, parsePasswordChangeResponse } from '../apps/web/src/lib/account-profile-contract.js';

const account = { email: 'owner@example.test', name: 'Owner', authProviders: ['password'], hasLocalPassword: true };

describe('account profile response', () => {
  it('accepts the editable account projection', () => {
    expect(parseAccountProfileResponse({ account })).toEqual(account);
  });

  it('rejects incomplete profile data before populating controls', () => {
    expect(parseAccountProfileResponse({ account: { ...account, authProviders: ['password', 4] } })).toBeNull();
    expect(parseAccountProfileResponse({ account: { ...account, hasLocalPassword: 'yes' } })).toBeNull();
  });

  it('requires an explicit successful password-change message', () => {
    expect(parsePasswordChangeResponse({ success: true, message: 'Password updated.' })).toBe('Password updated.');
    expect(parsePasswordChangeResponse({ success: true })).toBeNull();
    expect(parsePasswordChangeResponse({ success: false, message: 'Password updated.' })).toBeNull();
  });
});
