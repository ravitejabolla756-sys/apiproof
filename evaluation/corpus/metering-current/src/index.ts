import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function report(customer: string, value: string) {
  return stripe.billing.meterEvents.create({ event_name: 'requests', payload: { stripe_customer_id: customer, value } });
}
