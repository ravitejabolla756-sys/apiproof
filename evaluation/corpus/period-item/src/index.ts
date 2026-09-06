import Stripe from 'stripe';
export function renewal(item: Stripe.SubscriptionItem) {
  return item.current_period_end;
}
