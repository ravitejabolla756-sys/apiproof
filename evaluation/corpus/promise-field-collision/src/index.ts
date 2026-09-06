import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function local() { return Promise.resolve({ current_period_end: 0 }).then(subscription => subscription.current_period_end); }
export const remote = (id: string) => client.subscriptionItems.retrieve(id).then(item => item.current_period_end);
