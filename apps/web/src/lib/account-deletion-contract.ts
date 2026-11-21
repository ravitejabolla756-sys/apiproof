export const accountDeletionAvailability = {
  status: 'unavailable' as const,
  code: 'DELETION_CONTRACT_PENDING' as const,
  heading: 'Account deletion',
  message: 'Account deletion is unavailable until the retention and deletion contract is approved. No deletion request can be submitted from this beta surface.',
  actionLabel: 'Account deletion unavailable',
};
