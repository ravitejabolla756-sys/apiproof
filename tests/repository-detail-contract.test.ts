import { describe, expect, it } from 'vitest';
import { parseRepositoryDetailResponse } from '../apps/web/src/lib/repository-detail-contract.js';

const repository = {
  id: 'repo-1', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: '123',
  default_branch: 'main', status: 'connected', last_scan_at: null, created_at: '2026-11-09T00:00:00.000Z',
};

describe('repository detail response', () => {
  it('accepts the API projection and preserves files_analyzed', () => {
    expect(parseRepositoryDetailResponse({ repository, scans: [{ id: 'scan-1', sha: 'abc123', status: 'completed', files_analyzed: 12, findings_count: 1, started_at: '2026-11-09T00:00:00.000Z', completed_at: null }], findings: [] })).toMatchObject({ scans: [{ files_analyzed: 12 }] });
  });

  it('rejects an unsafe detail envelope instead of rendering partial data', () => {
    expect(parseRepositoryDetailResponse({ repository, scans: [{ id: 'scan-1', sha: 'abc123', status: 'completed', analyzed_files: 12, total_files: 12, findings_count: 0, started_at: '2026-11-09T00:00:00.000Z', completed_at: null }], findings: [] })).toBeNull();
  });
});
