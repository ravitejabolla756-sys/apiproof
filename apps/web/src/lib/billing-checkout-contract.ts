export type BillingCheckoutAvailability = {
  status: 'unavailable';
  code: 'BILLING_CHECKOUT_CONTRACT_PENDING';
  developerLabel: 'Rolling out — no checkout';
  startupLabel: 'Coming soon — no checkout';
  message: string;
};

/** Keep paid-plan cards display-only until the approved billing lifecycle exists. */
export const billingCheckoutAvailability: BillingCheckoutAvailability = {
  status: 'unavailable',
  code: 'BILLING_CHECKOUT_CONTRACT_PENDING',
  developerLabel: 'Rolling out — no checkout',
  startupLabel: 'Coming soon — no checkout',
  message: 'Paid plans are visible while they roll out, but cannot be purchased yet.',
};
