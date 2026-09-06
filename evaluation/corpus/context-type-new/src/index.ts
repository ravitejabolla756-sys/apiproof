import Stripe from 'stripe';
export function serialize(context: Stripe.StripeContextType) {
  return context.toString();
}
