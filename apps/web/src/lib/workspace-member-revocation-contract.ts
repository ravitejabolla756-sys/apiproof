export type WorkspaceMemberRevocationAvailability = {
  status: 'unavailable';
  code: 'ORG_10_CONTRACT_PENDING';
  message: string;
};

/**
 * Member removal stays unavailable until the authoritative ORG-10 transaction
 * is integrated. The current local endpoint invalidates every session for the
 * target user, which is not a safe workspace-scoped revocation contract.
 */
export const workspaceMemberRevocationAvailability: WorkspaceMemberRevocationAvailability = {
  status: 'unavailable',
  code: 'ORG_10_CONTRACT_PENDING',
  message: 'Member removal is unavailable until workspace-scoped revocation is connected. Personal sessions and access to other workspaces must be preserved.',
};
