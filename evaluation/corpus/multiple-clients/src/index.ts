import Stripe from 'stripe';
const first = new Stripe(process.env.FIRST_STRIPE_KEY!);
const second = new Stripe(process.env.SECOND_STRIPE_KEY!);
export async function previews(a: string, b: string) {
  const one = await first.invoices.retrieveUpcoming({ customer: a });
  const two = await second.invoices.retrieveUpcoming({ customer: b });
  return [one, two];
}
