import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
export class Billing {
  constructor(private readonly api: Stripe) {}
  preview() { return this.api.invoices.retrieveUpcoming({}); }
  subscribe() { return this.api.subscriptions.create({ coupon: 'launch' }); }
  async period(id: string) { const s = await this.api.subscriptions.retrieve(id); return s.current_period_end; }
}
