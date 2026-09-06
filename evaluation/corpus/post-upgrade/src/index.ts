import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function subscribe(customer: string, coupon: string) {
  return stripe.subscriptions.create({ customer, discounts: [{ coupon }] });
}
