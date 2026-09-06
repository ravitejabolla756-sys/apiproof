import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const quote = () => client.invoices.retrieveUpcoming({});
export const subscribe = () => client.subscriptions.create({ coupon: 'launch' });
