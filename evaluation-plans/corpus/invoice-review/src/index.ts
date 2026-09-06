import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
client.invoices.retrieveUpcoming({ customer: 'cus_123' });
