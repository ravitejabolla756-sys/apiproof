import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function a() { return { coupon: 'launch' }; }
function b() { return a(); }
function c() { return b(); }
function d() { return c(); }
function e() { return d(); }
export const subscribe = () => client.subscriptions.create(e());
