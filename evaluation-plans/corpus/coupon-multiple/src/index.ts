import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
client.subscriptions.create({ coupon: 'launch' });
client.subscriptions.update('sub_123', { promotion_code: 'promo' });
