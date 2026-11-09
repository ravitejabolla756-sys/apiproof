import { describe, expect, it } from 'vitest';
import { billingCheckoutAvailability } from '../apps/web/src/lib/billing-checkout-contract.js';

describe('billing checkout contract boundary', () => {
  it('keeps paid-plan checkout unavailable until the billing lifecycle is approved', () => {
    expect(billingCheckoutAvailability).toEqual({
      status: 'unavailable',
      code: 'BILLING_CHECKOUT_CONTRACT_PENDING',
      developerLabel: 'Rolling out — no checkout',
      startupLabel: 'Coming soon — no checkout',
      message: 'Paid plans are visible while they roll out, but cannot be purchased yet.',
    });
  });
});
