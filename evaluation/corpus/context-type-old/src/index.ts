import Stripe from 'stripe';
export function serialize(context: Stripe.StripeContext) {
  return context.toString();
}
