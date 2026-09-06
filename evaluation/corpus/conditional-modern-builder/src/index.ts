import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function subscribe(condition: boolean) { const build = () => condition ? { discounts: [] } : { customer: 'example' }; return client.subscriptions.create(build()); }
