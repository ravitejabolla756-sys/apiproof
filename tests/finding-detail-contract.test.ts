import { describe, expect, it } from 'vitest';
import { parseFindingDetailResponse } from '../apps/web/src/lib/finding-detail-contract.js';

const finding = {
  id: 'finding-1', provider: 'Fixture', change_id: 'change-1', title: 'Breaking change', description: 'Review this change.',
  severity: 'high', confidence: 'high', file_path: 'src/example.ts', line_number: 12, symbol: 'example', reason: 'Changed API',
  source_snippet: null, status: 'open', created_at: '2026-11-09T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'acme/owl',
  repo_owner: 'acme', default_branch: 'main', evidence: [], reasonCodes: [], capability: null,
};

describe('finding detail response', () => {
  it('accepts a populated finding and explicit not-found envelope', () => {
    expect(parseFindingDetailResponse({ finding, migration: null })?.finding).toEqual(finding);
    expect(parseFindingDetailResponse({ finding: null, migration: null })).toMatchObject({ finding: null, migration: null });
  });

  it('rejects incomplete detail objects before rendering', () => {
    expect(parseFindingDetailResponse({ finding: { ...finding, line_number: 0 }, migration: null })).toBeNull();
    expect(parseFindingDetailResponse({ finding, migration: { id: 'migration-1', status: 'planned' } })).toBeNull();
  });
});
