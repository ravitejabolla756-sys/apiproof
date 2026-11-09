import { describe, expect, it } from 'vitest';
import { parseAuthenticatedSession, parseAuthMutationError, parseAuthMutationSuccess } from '../apps/web/src/lib/auth-response-contract.js';

describe('authentication mutation response contract', () => {
  it('requires an explicit success marker', () => {
    expect(parseAuthMutationSuccess({ success: true })).toBe(true);
    expect(parseAuthMutationSuccess({ user: { id: 'user-1' } })).toBe(false);
    expect(parseAuthMutationSuccess(null)).toBe(false);
  });

  it('requires a boolean authenticated session projection', () => {
    expect(parseAuthenticatedSession({ authenticated: true })).toBe(true);
    expect(parseAuthenticatedSession({ authenticated: false })).toBe(false);
    expect(parseAuthenticatedSession({ authenticated: 'true' })).toBe(false);
    expect(parseAuthenticatedSession({ authenticated: 1 })).toBe(false);
    expect(parseAuthenticatedSession(null)).toBe(false);
  });

  it('uses safe fallback text for malformed errors', () => {
    expect(parseAuthMutationError({ error: ' Invalid credentials. ' }, 'Authentication failed.')).toBe('Invalid credentials.');
    expect(parseAuthMutationError({ error: 401 }, 'Authentication failed.')).toBe('Authentication failed.');
    expect(parseAuthMutationError(undefined, 'Authentication failed.')).toBe('Authentication failed.');
  });
});
