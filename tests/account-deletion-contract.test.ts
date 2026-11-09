import { describe, expect, it } from 'vitest';
import { accountDeletionAvailability } from '../apps/web/src/lib/account-deletion-contract.js';

describe('account deletion contract boundary', () => {
  it('keeps deletion unavailable until retention and deletion are approved', () => {
    expect(accountDeletionAvailability).toEqual({
      status: 'unavailable',
      code: 'DELETION_CONTRACT_PENDING',
      heading: 'Account deletion',
      message: 'Account deletion is unavailable until the retention and deletion contract is approved. No deletion request can be submitted from this beta surface.',
      actionLabel: 'Account deletion unavailable',
    });
  });
});
