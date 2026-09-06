import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function preview(version: Stripe.LatestApiVersion) { const api = new Stripe(process.env.KEY!, { apiVersion: version }); return api.invoices.retrieveUpcoming({}); }
