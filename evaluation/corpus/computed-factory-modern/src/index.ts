import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
function operation() { return 'createPreview' as const; }
export const preview = () => client.invoices[operation()]({ customer: 'example', subscription: 'example' });
