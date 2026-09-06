import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function discount(id: string, coupon: string) {
  return client.subscriptions.update(id, { coupon });
}
