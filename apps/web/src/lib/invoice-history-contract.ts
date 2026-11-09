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

export function formatInvoiceAmount(invoice: Pick<InvoiceHistoryRecord, 'totalMinor' | 'currency'>): string {
  const currency = invoice.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(invoice.totalMinor)) return 'Unavailable';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(invoice.totalMinor / 100);
  } catch {
    return 'Unavailable';
  }
}

export function toSafeInvoiceDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

export function formatInvoiceDate(value: string | null | undefined): string {
  const safeValue = toSafeInvoiceDateTime(value);
  return safeValue ? new Date(safeValue).toLocaleDateString() : 'Unavailable';
}

export function toSafeInvoiceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
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
