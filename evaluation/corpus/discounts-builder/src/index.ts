import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function build(customer: string, coupon: string) {
  return { customer, coupon };
}
export function subscribe(customer: string, coupon: string) {
  return client.subscriptions.create(build(customer, coupon));
}
