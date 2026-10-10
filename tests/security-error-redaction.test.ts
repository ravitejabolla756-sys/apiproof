import { describe, expect, it } from 'vitest';
import { formatLogEntry, safeErrorCode } from '../apps/web/src/lib/server/logger.js';

describe('safe beta error boundaries', () => {
  it('keeps public error codes limited to explicit uppercase identifiers', () => {
    expect(safeErrorCode(new Error('GITHUB_AUTHORIZATION_FAILED'), 'FALLBACK')).toBe('GITHUB_AUTHORIZATION_FAILED');
    expect(safeErrorCode(new Error('database password=super-secret'), 'FALLBACK')).toBe('FALLBACK');
    expect(safeErrorCode(new Error(''), 'FALLBACK')).toBe('FALLBACK');
  });

  it('redacts credentials from structured operational logs', () => {
    const output = formatLogEntry('warn', 'operation failed', { authorization: 'Bearer ghs_secret_token_value' }, new Error('password=secret-value'));
    expect(output).not.toContain('ghs_secret_token_value');
    expect(output).not.toContain('secret-value');
    expect(output).toContain('[REDACTED]');
  });
});
