import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function renewal(id: string) {
  const pending = client.subscriptions.retrieve(id);
  const alias = pending;
  return alias.then(function(subscription) { return subscription.current_period_end; });
}
export const quote = () => client.invoices.retrieveUpcoming({});
