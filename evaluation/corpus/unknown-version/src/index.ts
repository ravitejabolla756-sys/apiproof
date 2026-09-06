import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function preview(customer: string) {
  return stripe.invoices.retrieveUpcoming({ customer });
}
