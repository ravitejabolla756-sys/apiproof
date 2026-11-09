import { describe, expect, it } from 'vitest';
import { parseEmailVerificationError, parseEmailVerificationSuccess } from '../apps/web/src/lib/email-verification-contract.js';

describe('email verification response contract', () => {
  it('accepts only explicit non-empty success projections', () => {
    expect(parseEmailVerificationSuccess({ success: true, message: ' Email verified. ' })).toEqual({ message: 'Email verified.' });
    expect(parseEmailVerificationSuccess({ message: 'Email verified.' })).toBeNull();
    expect(parseEmailVerificationSuccess({ success: true, message: ' ' })).toBeNull();
  });

  it('uses safe fallback text for malformed errors', () => {
    expect(parseEmailVerificationError({ error: ' Link expired. ' }, 'Verification unavailable.')).toBe('Link expired.');
    expect(parseEmailVerificationError({ error: false }, 'Verification unavailable.')).toBe('Verification unavailable.');
    expect(parseEmailVerificationError(undefined, 'Verification unavailable.')).toBe('Verification unavailable.');
  });
});
