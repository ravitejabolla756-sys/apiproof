import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function build() { return { coupon: 'unused' }; }
function period(s: { current_period_end: number }) { return s.current_period_end; }
export const subscribe = () => client.subscriptions.create({ discounts: [] });
export const unusedHelpers = { build, period };
