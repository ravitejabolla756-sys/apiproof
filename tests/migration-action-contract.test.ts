import { describe, expect, it } from 'vitest';
import { parseMigrationActionError, parseMigrationPlanResponse, parseMigrationProposalResponse, parseMigrationVerificationResponse } from '../apps/web/src/lib/migration-action-contract.js';

const migration = { id: 'migration-1', status: 'planned', patch_diff: 'diff', patch_digest: 'digest' };

describe('migration action response contract', () => {
  it('requires explicit plan success and migration identity', () => {
    expect(parseMigrationPlanResponse({ success: true, migration })).toEqual({ migration });
    expect(parseMigrationPlanResponse({ migration })).toBeNull();
    expect(parseMigrationPlanResponse({ success: true, migration: { id: 'migration-1' } })).toBeNull();
  });

  it('accepts only a complete proposal or verification job envelope', () => {
    expect(parseMigrationProposalResponse({ success: true, proposal: { number: 12, state: 'draft', branchName: 'owl/change' } })).not.toBeNull();
    expect(parseMigrationProposalResponse({ success: true, job: { id: 'job-1', status: 'pending' } })).not.toBeNull();
    expect(parseMigrationProposalResponse({ success: true })).toBeNull();
    expect(parseMigrationProposalResponse({ success: true, job: { id: 'job-1' } })).toBeNull();
  });

  it('validates polling and error projections', () => {
    expect(parseMigrationVerificationResponse({ id: 'job-1', status: 'completed', proposal: { number: 12, state: 'draft', branchName: 'owl/change' } })).toEqual({ status: 'completed', proposal: { number: 12, state: 'draft', branchName: 'owl/change' } });
    expect(parseMigrationVerificationResponse({ status: 'completed' })).toBeNull();
    expect(parseMigrationActionError({ error: ' Failed. ' }, 'Migration failed.')).toBe('Failed.');
    expect(parseMigrationActionError(null, 'Migration failed.')).toBe('Migration failed.');
  });
});
