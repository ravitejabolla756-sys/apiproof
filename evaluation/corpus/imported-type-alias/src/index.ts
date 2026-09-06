import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
import type { StripeContext as Context } from 'stripe';
export const keep = (input: Context) => input;
export function modern(s: Stripe.SubscriptionItem) { return s.current_period_end; }
