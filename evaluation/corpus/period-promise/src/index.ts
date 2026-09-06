import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function renewal(id: string) {
  return client.subscriptions.retrieve(id).then(subscription => subscription.current_period_end);
}
