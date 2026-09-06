import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
const build = (customer: string) => ({ customer, coupon: 'launch' });
export const subscribe = (id: string) => client.subscriptions.create(build(id)).then(s => s.current_period_end);
