import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function preview(operation: 'retrieveUpcoming', customer: string) { return client.invoices[operation]({ customer }); }
export const run = () => preview('retrieveUpcoming', 'example');
