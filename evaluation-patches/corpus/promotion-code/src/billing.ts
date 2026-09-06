import Stripe from 'stripe';
const client = new Stripe('');
client.subscriptions.create({ promotion_code: 'promo_1' });
