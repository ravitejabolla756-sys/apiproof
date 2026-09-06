import Stripe from 'stripe';

const client = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function loadCustomer(id: string) {
  return client.customers.retrieve(id);
}
