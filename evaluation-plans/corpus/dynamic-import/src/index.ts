export async function preview() { const { default: Stripe } = await import('stripe'); const client = new Stripe(process.env.KEY!); return client.invoices.retrieveUpcoming({}); }
