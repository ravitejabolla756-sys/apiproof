/**
 * Deterministic source used only by offline test scans.
 *
 * Keeping the scan and verification fixture in one place is important: the
 * production path always reads the exact remote commit, while the offline
 * path must produce the same bytes at both boundaries so source-digest
 * verification remains meaningful.
 */
export function createSyntheticTestFixtureFiles(repositoryName: string): Map<string, string> {
  return new Map([
    ['package.json', JSON.stringify({
      name: repositoryName,
      dependencies: { stripe: '^16.0.0', twilio: '^3.80.0' },
    }, null, 2)],
    ['src/billing.ts', `import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function createCustomerSubscription(customerId: string, priceId: string, couponId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    coupon: couponId
  });
}`],
  ]);
}
