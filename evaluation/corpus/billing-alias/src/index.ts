import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const api = stripe;
export function preview(customer: string) {
  return api.invoices.retrieveUpcoming({ customer });
}
export function subscribe(customer: string, coupon: string) {
  const params = { customer, coupon };
  return api.subscriptions.create(params);
}
