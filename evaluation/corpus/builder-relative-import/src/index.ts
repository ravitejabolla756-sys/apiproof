import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
import { build } from './params';
export async function subscribe() { const s = await client.subscriptions.create(build()); return s.current_period_start; }
