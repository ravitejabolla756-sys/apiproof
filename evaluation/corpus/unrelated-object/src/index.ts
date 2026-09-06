interface InvoiceStore { retrieveUpcoming(input: { customer: string }): Promise<unknown> }
export function preview(invoices: InvoiceStore, customer: string) {
  return invoices.retrieveUpcoming({ customer });
}
