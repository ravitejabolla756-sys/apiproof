import Stripe from 'stripe';
const client = new Stripe('');
const couponId = 'launch';
client.subscriptions.update('sub_1', { coupon: couponId });
