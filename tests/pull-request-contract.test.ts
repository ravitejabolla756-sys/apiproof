import { describe, expect, it } from 'vitest';
import { parsePullRequestCollection, toSafePullRequestUrl } from '../apps/web/src/lib/pull-request-contract.js';

const validPullRequest = {
  id: 'pr-1', number: 12, title: 'Update dependency', branch_name: 'owl/update', base_branch: 'main',
  url: 'https://github.com/org/repo/pull/12', state: 'open', created_at: '2026-11-08T00:00:00.000Z', patch_digest: 'digest',
  repo_name: 'repo', repo_full_name: 'org/repo', symbol: 'client.request', file_path: 'src/client.ts', change_id: 'change-1',
};

describe('pull-request external link boundary', () => {
  it('normalizes a valid pull-request collection', () => {
    expect(parsePullRequestCollection({ pullRequests: [{ ...validPullRequest, title: ' Update dependency ' }] })).toEqual([{ ...validPullRequest, title: 'Update dependency' }]);
  });

  it('rejects malformed or duplicate pull-request projections', () => {
    expect(parsePullRequestCollection({ pullRequests: [{ ...validPullRequest, number: 0 }] })).toBeNull();
    expect(parsePullRequestCollection({ pullRequests: [{ ...validPullRequest, id: '   ' }] })).toBeNull();
    expect(parsePullRequestCollection({ pullRequests: [validPullRequest, validPullRequest] })).toBeNull();
  });

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
