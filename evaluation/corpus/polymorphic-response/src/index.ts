import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function identity<T>(value: T) { return value; }
export function renewal(id: string) { return client.subscriptions.retrieve(id).then(s => identity(s)).then(value => value.current_period_end); }
export const local = () => identity({ current_period_end: 0 });
