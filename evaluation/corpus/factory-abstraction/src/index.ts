import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function factory() { return { billing: new Stripe(process.env.KEY!) }; }
export function preview() { const service = factory(); return service.billing.invoices.retrieveUpcoming({}); }
