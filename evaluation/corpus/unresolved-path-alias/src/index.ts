import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_SECRET_KEY!);
import { api } from '@/billing';
export const preview = () => api.invoices.retrieveUpcoming({});
