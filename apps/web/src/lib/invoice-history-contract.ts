export interface InvoiceHistoryRecord {
  id: string;
  number: string;
  issuedAt: string;
  status: string;
  totalMinor: number;
  currency: string;
  hostedUrl?: string | null;
}

export type InvoiceHistoryResult =
  | { status: 'unavailable'; code: 'PROVIDER_NOT_CONFIGURED'; message: string }
  | { status: 'ready'; invoices: InvoiceHistoryRecord[] };

export interface InvoiceHistoryAdapter {
  load: () => Promise<InvoiceHistoryResult>;
}

export const unavailableInvoiceHistoryAdapter: InvoiceHistoryAdapter = {
  async load() {
    return {
      status: 'unavailable',
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'Invoice history is unavailable in the free beta. No provider-backed invoices or paid entitlements are represented here.',
    };
  },
};
