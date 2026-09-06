import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function renewal(id: string) {
  const { current_period_end: renewsAt } = await client.subscriptions.retrieve(id);
  return renewsAt;
}
