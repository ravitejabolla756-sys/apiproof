import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
const original = 'retrieveUpcoming' as const;
const action = original;
export const quote = () => client.invoices[action]({});
const create = 'create' as const;
export const subscribe = () => client.subscriptions[create]({ coupon: 'launch' });
