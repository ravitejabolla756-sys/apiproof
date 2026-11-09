export type AccountDeletionAvailability = {
  status: 'unavailable';
  code: 'DELETION_CONTRACT_PENDING';
  heading: 'Account deletion';
  message: string;
  actionLabel: 'Account deletion unavailable';
};

/**
 * Keep deletion non-destructive until retention, legal and backend contracts
 * are approved and integrated.
 */
export const accountDeletionAvailability: AccountDeletionAvailability = {
  status: 'unavailable',
  code: 'DELETION_CONTRACT_PENDING',
  heading: 'Account deletion',
  message: 'Account deletion is unavailable until the retention and deletion contract is approved. No deletion request can be submitted from this beta surface.',
  actionLabel: 'Account deletion unavailable',
};
