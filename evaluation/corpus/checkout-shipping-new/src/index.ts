import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function checkout(rate: string) {
  return stripe.checkout.sessions.create({ mode: 'payment', shipping_options: [{ shipping_rate: rate }] });
}
