import { describe, expect, it } from 'vitest';
import { billingPortalAvailability } from '../apps/web/src/lib/billing-portal-contract.js';

describe('billing portal contract boundary', () => {
  it('keeps portal access unavailable until provider session contracts are approved', () => {
    expect(billingPortalAvailability).toEqual({
      status: 'unavailable',
      code: 'BILLING_PORTAL_CONTRACT_PENDING',
      label: 'Billing portal unavailable in beta',
      message: 'Billing portal is unavailable in this beta until an approved provider session and owner-authorized return URL are connected.',
    });
  });
});
