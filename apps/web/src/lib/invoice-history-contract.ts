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

  // Date.parse normalizes impossible calendar dates (for example, February 31)
  // into a different valid date. Validate the calendar portion before relying on
  // the platform parser so a malformed provider projection fails closed.
  const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = Number(calendar[2]);
    const day = Number(calendar[3]);
    const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
    if (day < 1 || day > daysInMonth) return null;
  }

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
