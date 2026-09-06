import Stripe from 'stripe';
export class BillingService {
  private stripe: Stripe;
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  charge(amount: number) {
    return this.stripe.paymentIntents.create({ amount, currency: 'usd' });
  }
  preview(customer: string) {
    return this.stripe.invoices.retrieveUpcoming({ customer });
  }
}
