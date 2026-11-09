import { describe, expect, it } from 'vitest';
import { parseRepositoryCollection } from '../apps/web/src/lib/repository-contract.js';

const repository = {
  id: 'repo-1', owner: 'fixture', name: 'owl', full_name: 'fixture/owl', github_repository_id: 'gh-1', default_branch: 'main', status: 'healthy',
  last_scan_at: null, created_at: '2026-11-08T00:00:00.000Z', findings_count: 0, scans_count: 1, last_scan_sha: null,
};

describe('repository response contract', () => {
  it('normalizes a valid repository projection', () => {
    expect(parseRepositoryCollection({ repositories: [{ ...repository, name: ' owl ' }] })).toEqual([{ ...repository, name: 'owl' }]);
  });

  it('rejects malformed counts, missing identity and duplicate repositories', () => {
    expect(parseRepositoryCollection({ repositories: [{ ...repository, findings_count: -1 }] })).toBeNull();
    expect(parseRepositoryCollection({ repositories: [{ ...repository, github_repository_id: ' ' }] })).toBeNull();
    expect(parseRepositoryCollection({ repositories: [repository, repository] })).toBeNull();
  });
});
