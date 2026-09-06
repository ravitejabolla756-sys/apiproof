import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function renewal(id: string) {
  const subscription = await client.subscriptions.retrieve(id);
  return subscription.current_period_end;
}
