export type DigestAvailability = {
  status: 'unavailable';
  code: 'DIGEST_CONTRACT_PENDING';
  message: string;
};

/**
 * The UI may describe the boundary, but cadence, timezone, recipients and
 * scheduler ownership must come from the approved server contract.
 */
export const digestAvailability: DigestAvailability = {
  status: 'unavailable',
  code: 'DIGEST_CONTRACT_PENDING',
  message: 'Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.',
};
