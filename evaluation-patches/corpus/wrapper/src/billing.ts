import Stripe from 'stripe';
const client = new Stripe('');
function migrate(api: any) { api.subscriptions.create({ coupon: 'launch' }); }
migrate(client);
