import { describe, expect, it } from 'vitest';
import { workspaceMemberRevocationAvailability } from '../apps/web/src/lib/workspace-member-revocation-contract.js';

describe('workspace member revocation contract boundary', () => {
  it('keeps member removal unavailable until ORG-10 is integrated', () => {
    expect(workspaceMemberRevocationAvailability).toEqual({
      status: 'unavailable',
      code: 'ORG_10_CONTRACT_PENDING',
      message: 'Member removal is unavailable until workspace-scoped revocation is connected. Personal sessions and access to other workspaces must be preserved.',
    });
  });
});
