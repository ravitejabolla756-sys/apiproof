import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function subscribe(customer: string, coupon: string) {
  return client.subscriptions.create({ customer, metadata: { coupon } });
}
