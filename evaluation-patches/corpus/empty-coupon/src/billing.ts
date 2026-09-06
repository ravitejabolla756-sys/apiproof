import Stripe from 'stripe';
const client = new Stripe('');
client.subscriptions.update('sub_1', { coupon: '' });
