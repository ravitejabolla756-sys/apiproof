import Stripe from 'stripe';
const client = new Stripe('');
client.invoices.retrieveUpcoming({ customer: 'cus_1' });
