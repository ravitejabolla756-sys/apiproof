import { describe, expect, it } from 'vitest';
import { safeFailureCode } from '../apps/web/src/lib/server/productization-persistence.js';

describe('safe worker failure codes', () => {
  it('preserves recognized application error codes and removes descriptive suffixes', () => {
    expect(safeFailureCode(new Error('GITHUB_REPOSITORY_EMPTY: private/repo has no code files'), 'SCAN_FAILED'))
      .toBe('GITHUB_REPOSITORY_EMPTY');
    expect(safeFailureCode(new Error('GITHUB_FILE_FETCH_ERROR'), 'SOURCE_FETCH_FAILED'))
      .toBe('GITHUB_FILE_FETCH_ERROR');
  });

  it('maps unknown, secret-shaped, and non-error values to the fixed fallback', () => {
    for (const value of [
      new Error('AWS_SECRET_ACCESS_KEY'),
      new Error('AWS_SECRET_ACCESS_KEY:ABCD1234MUSTNOTESCAPE'),
      new Error('GHPSUPERSECRETSTRING'),
      new Error('vendor failure: credential=private-value'),
      'GITHUB_REPOSITORY_EMPTY',
    ]) {
      expect(safeFailureCode(value, 'SCAN_EXECUTION_FAILED')).toBe('SCAN_EXECUTION_FAILED');
    }
  });
});
