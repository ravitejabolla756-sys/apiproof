import Stripe from 'stripe';
export function renewal(subscription: Stripe.Subscription) {
  return subscription.current_period_end;
}
