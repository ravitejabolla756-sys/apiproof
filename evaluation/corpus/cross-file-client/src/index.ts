import { client as billing } from './client.js';
export function preview(customer: string) {
  return billing.invoices.retrieveUpcoming({ customer });
}
