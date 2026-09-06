import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
const invoices = client.invoices as unknown as { retrieveUpcoming?: () => unknown };
export function available() { if (invoices?.retrieveUpcoming) return true; return false; }
export const hasFunction = typeof invoices.retrieveUpcoming === 'function';
export const absent = invoices.retrieveUpcoming == null;
