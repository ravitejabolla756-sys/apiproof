const StripeSdk = require('stripe');
const client = StripeSdk(process.env.STRIPE_SECRET_KEY);
export function getCustomer(id: string) {
  return client.customers.retrieve(id);
}
