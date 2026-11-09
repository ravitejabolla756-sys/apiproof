import { describe, expect, it } from 'vitest';
import { parseFindingCollection } from '../apps/web/src/lib/findings-contract.js';

const finding = {
  id: 'finding-1', provider: 'Fixture', change_id: 'change-1', title: 'Breaking change', description: 'Review this call site.', severity: 'high', confidence: 'high',
  file_path: 'src/client.ts', line_number: 12, symbol: 'client.request', status: 'open', created_at: '2026-11-08T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'fixture/owl',
  pr_number: null, pr_url: null, pr_state: null, capability: { migrationAvailable: true, recommendedNextAction: 'MIGRATION_AVAILABLE' as const },
};

describe('findings response contract', () => {
  it('normalizes a valid finding projection', () => {
    expect(parseFindingCollection({ findings: [{ ...finding, title: ' Breaking change ' }] })).toEqual([{ ...finding, title: 'Breaking change' }]);
  });

  it('rejects malformed, invalid-action and duplicate findings', () => {
    expect(parseFindingCollection({ findings: [{ ...finding, line_number: 0 }] })).toBeNull();
    expect(parseFindingCollection({ findings: [{ ...finding, capability: { migrationAvailable: true, recommendedNextAction: 'UNKNOWN' } }] })).toBeNull();
    expect(parseFindingCollection({ findings: [finding, finding] })).toBeNull();
  });
});
