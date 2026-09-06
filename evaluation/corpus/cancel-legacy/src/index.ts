import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function cancelSubscription(id: string) {
  return stripe.subscriptions.del(id);
}
