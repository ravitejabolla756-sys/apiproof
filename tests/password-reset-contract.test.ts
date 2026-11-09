import { describe, expect, it } from 'vitest';
import { parsePasswordResetError, parsePasswordResetSuccess } from '../apps/web/src/lib/password-reset-contract.js';

describe('password reset response contract', () => {
  it('accepts only explicit non-empty success projections', () => {
    expect(parsePasswordResetSuccess({ success: true, message: ' Password reset successfully. ' })).toEqual({ message: 'Password reset successfully.' });
    expect(parsePasswordResetSuccess({ message: 'Password reset successfully.' })).toBeNull();
    expect(parsePasswordResetSuccess({ success: true })).toBeNull();
    expect(parsePasswordResetSuccess({ success: true, message: '   ' })).toBeNull();
  });

  it('uses safe fallback text for malformed errors', () => {
    expect(parsePasswordResetError({ error: ' Reset link expired. ' }, 'Unable to reset password.')).toBe('Reset link expired.');
    expect(parsePasswordResetError({ error: 503 }, 'Unable to reset password.')).toBe('Unable to reset password.');
    expect(parsePasswordResetError(null, 'Unable to reset password.')).toBe('Unable to reset password.');
  });
});
