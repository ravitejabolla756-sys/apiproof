import { describe, expect, it } from 'vitest';
import { toSafePullRequestUrl } from '../apps/web/src/lib/pull-request-contract.js';

describe('pull-request external link boundary', () => {
  it('accepts absolute credential-free HTTPS URLs', () => {
    expect(toSafePullRequestUrl('https://github.com/org/repo/pull/12')).toBe('https://github.com/org/repo/pull/12');
  });

  it('rejects non-HTTPS, relative and credential-bearing URLs', () => {
    expect(toSafePullRequestUrl('http://github.com/org/repo/pull/12')).toBeNull();
    expect(toSafePullRequestUrl('/dashboard/pull-requests')).toBeNull();
    expect(toSafePullRequestUrl('https://user:secret@github.com/org/repo/pull/12')).toBeNull();
    expect(toSafePullRequestUrl('javascript:alert(1)')).toBeNull();
  });
});
