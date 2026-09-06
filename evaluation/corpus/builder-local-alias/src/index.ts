import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function build() { const params = { coupon: 'launch' }; const alias = params; return alias; }
export function change(id: string) { return client.subscriptions.update(id, build()); }
export function quote() { return client.invoices.retrieveUpcoming({}); }
