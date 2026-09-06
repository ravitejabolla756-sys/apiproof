const stripe = { customers: { retrieve: (id: string) => id } };
const comment = 'import Stripe from "stripe"';
export function localCustomer(id: string) { return stripe.customers.retrieve(id) + comment; }
