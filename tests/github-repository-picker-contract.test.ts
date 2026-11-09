import { describe, expect, it } from 'vitest';
import { parseGitHubRepositoryPickerResponse } from '../apps/web/src/lib/github-repository-picker-contract.js';

describe('GitHub repository picker response', () => {
  it('accepts connected and empty picker states', () => {
    expect(parseGitHubRepositoryPickerResponse({ connected: false, repositories: [] })).toEqual({ connected: false, repositories: [] });
    expect(parseGitHubRepositoryPickerResponse({ connected: true, repositories: [{ id: 'repo-1', name: 'owl', fullName: 'acme/owl', owner: 'acme', private: true, defaultBranch: 'main' }] })).toMatchObject({ connected: true });
  });

  it('rejects malformed or duplicate repository projections', () => {
    expect(parseGitHubRepositoryPickerResponse({ connected: 'true', repositories: [] })).toBeNull();
    expect(parseGitHubRepositoryPickerResponse({ connected: true, repositories: [{ id: 'repo-1', name: 'owl' }] })).toBeNull();
    const repository = { id: 'repo-1', name: 'owl', fullName: 'acme/owl', owner: 'acme', private: false, defaultBranch: 'main' };
    expect(parseGitHubRepositoryPickerResponse({ connected: true, repositories: [repository, repository] })).toBeNull();
  });
});
