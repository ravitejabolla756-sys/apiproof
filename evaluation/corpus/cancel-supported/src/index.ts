import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function cancelSubscription(id: string) {
  return client.subscriptions.cancel(id);
}
