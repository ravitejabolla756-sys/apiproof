import Stripe from 'stripe';
const client = new Stripe('');
client.subscriptions.del('sub_1');
