export type BillingPortalAvailability = {
  status: 'unavailable';
  code: 'BILLING_PORTAL_CONTRACT_PENDING';
  label: 'Billing portal unavailable in beta';
  message: string;
};

/**
 * Keep portal access non-interactive until provider sessions and return-url
 * authorization are supplied by the reviewed billing backend.
 */
export const billingPortalAvailability: BillingPortalAvailability = {
  status: 'unavailable',
  code: 'BILLING_PORTAL_CONTRACT_PENDING',
  label: 'Billing portal unavailable in beta',
  message: 'Billing portal is unavailable in this beta until an approved provider session and owner-authorized return URL are connected.',
};
