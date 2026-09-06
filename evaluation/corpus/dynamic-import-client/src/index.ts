import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function preview() { const { default: SDK } = await import('stripe'); const api = new SDK(process.env.KEY!); return api.invoices.retrieveUpcoming({}); }
