import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
const wrap = <T>(value: T) => ({ value });
export async function renewal(id: string) { const envelope = wrap(wrap(await client.subscriptions.retrieve(id))); return envelope.value.value.current_period_end; }
