import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
const base = { coupon: 'launch' };
export function subscribe(customer: string) {
  return client.subscriptions.create({ ...base, customer });
}
