import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export function onboarding(account: string) {
  return stripe.accountLinks.create({ account, type: 'custom_account_verification' });
}
