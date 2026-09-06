import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function preview(method: string) { return client.invoices[method]({ customer: 'cus_123' }); }
