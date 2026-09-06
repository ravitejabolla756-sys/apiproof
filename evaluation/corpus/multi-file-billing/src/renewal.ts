import Stripe from 'stripe';
const other = new Stripe(process.env.KEY!);
export const quoteAgain = () => other.invoices.retrieveUpcoming({});
export async function renewal(id: string) { const s = await other.subscriptions.retrieve(id); return s.current_period_end; }
