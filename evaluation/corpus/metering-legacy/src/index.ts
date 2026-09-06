import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function report(item: string, quantity: number) {
  return stripe.subscriptionItems.createUsageRecord(item, { quantity, timestamp: 'now' });
}
