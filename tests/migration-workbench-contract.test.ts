import { describe, expect, it } from 'vitest';
import { parseMigrationWorkbenchCollection } from '../apps/web/src/lib/migration-workbench-contract.js';

const migration = {
  id: 'mig-1', finding_id: 'finding-1', repository_id: 'repo-1', plan_id: 'plan-1', status: 'planned', patch_diff: 'diff', patch_digest: 'digest',
  created_at: '2026-11-08T00:00:00.000Z', finding_title: 'Breaking change', symbol: 'client.request', file_path: 'src/client.ts', line_number: 12,
  change_id: 'change-1', repo_name: 'owl', repo_full_name: 'fixture/owl', lifecycle_state: 'Migration Planned' as const, pr_number: null, pr_url: null,
};

describe('migration workbench response contract', () => {
  it('normalizes a valid review projection', () => {
    expect(parseMigrationWorkbenchCollection({ migrations: [{ ...migration, finding_title: ' Breaking change ' }] })).toEqual([{ ...migration, finding_title: 'Breaking change', branch_name: null, execution_verified: false }]);
  });

  it('rejects malformed and duplicate review projections', () => {
    expect(parseMigrationWorkbenchCollection({ migrations: [{ ...migration, line_number: 0 }] })).toBeNull();
    expect(parseMigrationWorkbenchCollection({ migrations: [{ ...migration, lifecycle_state: 'Unknown' }] })).toBeNull();
    expect(parseMigrationWorkbenchCollection({ migrations: [migration, migration] })).toBeNull();
  });
});
