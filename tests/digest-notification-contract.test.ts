import { describe, expect, it } from 'vitest';
import { digestAvailability } from '../apps/web/src/lib/digest-notification-contract.js';

describe('digest notification contract boundary', () => {
  it('keeps scheduling unavailable until the shared contract is approved', () => {
    expect(digestAvailability).toEqual({
      status: 'unavailable',
      code: 'DIGEST_CONTRACT_PENDING',
      message: 'Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.',
    });
  });
});
