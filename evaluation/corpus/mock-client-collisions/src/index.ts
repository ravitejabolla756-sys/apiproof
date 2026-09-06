import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
interface InvoiceLike { retrieveUpcoming(): unknown; }
const stripe = { invoices: { retrieveUpcoming: () => ({}) }, subscriptions: { create: (params: unknown) => params } };
export function mock() { stripe.invoices.retrieveUpcoming(); stripe.subscriptions.create({ coupon: 'fake' }); }
export const documentation = 'client.invoices.retrieveUpcoming and current_period_end';
// client.subscriptions.create({ coupon: 'comment' });
export const local = (s: { current_period_end: number }) => s.current_period_end;
