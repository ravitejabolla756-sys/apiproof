import Stripe from 'stripe';
const client = new Stripe('');
client.subscriptions.create({ coupon: 'one' });
client.subscriptions.update('sub_1', { coupon: 'two' });
