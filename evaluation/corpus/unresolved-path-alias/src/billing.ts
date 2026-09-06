import Stripe from 'stripe';
export const api = new Stripe(process.env.KEY!);
