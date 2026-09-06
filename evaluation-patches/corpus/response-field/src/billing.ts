import Stripe from 'stripe';
const client = new Stripe('');
async function period() { const sub = await client.subscriptions.retrieve('sub_1'); return sub.current_period_end; }
