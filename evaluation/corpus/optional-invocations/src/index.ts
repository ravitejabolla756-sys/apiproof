import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const preview = () => client.invoices?.retrieveUpcoming?.({});
export const meter = (id: string) => client.subscriptionItems.createUsageRecord?.(id, { quantity: 1 });
