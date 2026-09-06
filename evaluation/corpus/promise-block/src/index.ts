import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function subscribe() {
  return client.subscriptions.create({ promotion_code: 'launch' }).then(subscription => {
    const { current_period_start } = subscription;
    return subscription.current_period_end - current_period_start;
  });
}
