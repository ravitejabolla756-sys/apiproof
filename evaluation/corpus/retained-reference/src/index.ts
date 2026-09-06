import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const billingDiagnostics = {
  upcomingAvailable: typeof (stripe.invoices as unknown as { retrieveUpcoming?: unknown }).retrieveUpcoming === 'function',
};
