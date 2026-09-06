import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
client.subscriptions.create({ coupon: 'launch' });
