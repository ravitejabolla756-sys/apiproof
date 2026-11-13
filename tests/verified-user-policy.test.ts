import { describe, expect, it } from 'vitest';
import { assertVerifiedUser, evaluateVerifiedUserPolicy } from '../apps/web/src/lib/server/verified-user-policy.js';

describe('verified-user policy boundary', () => {
  it('keeps onboarding and recovery available before verification', () => {
    for (const action of ['onboarding', 'recovery'] as const) {
      expect(evaluateVerifiedUserPolicy({ action, verificationStateAvailable: false })).toBe('allow');
    }
  });

  it('fails closed for protected actions when the verification state is unavailable', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: false })).toBe('verification_unavailable');
    expect(() => assertVerifiedUser({ action: 'workspace', verificationStateAvailable: false })).toThrow('VERIFICATION_STATE_UNAVAILABLE');
  });

  it('requires verification for protected actions until the server state is verified', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'provider_link', verificationStateAvailable: true })).toBe('require_verification');
    expect(evaluateVerifiedUserPolicy({ action: 'provider_link', verificationStateAvailable: true, emailVerifiedAt: null })).toBe('require_verification');
    expect(() => assertVerifiedUser({ action: 'provider_link', verificationStateAvailable: true, emailVerifiedAt: null })).toThrow('EMAIL_VERIFICATION_REQUIRED');
  });

  it('accepts only server-derived verified state or an approved provider verification', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: '2026-11-12T10:00:00.000Z' })).toBe('allow');
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, providerVerified: true })).toBe('allow');
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: 'not-a-date', providerVerified: false })).toBe('require_verification');
  });

  it('does not let an unapproved client-like value grant access', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, providerVerified: false, emailVerifiedAt: 'true' })).toBe('require_verification');
  });

  it('rejects a future verification timestamp instead of trusting clock-skewed state', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: future })).toBe('require_verification');
  });
});
