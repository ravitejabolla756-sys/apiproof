import { toSafeDisplayDateTime } from './date-display-contract.js';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate a future server-owned invoice projection before it reaches the UI. */
export function parseInvoiceHistoryResult(value: unknown): InvoiceHistoryResult | null {
  if (!isRecord(value) || (value.status !== 'unavailable' && value.status !== 'ready')) return null;
  if (value.status === 'unavailable') {
    return value.code === 'PROVIDER_NOT_CONFIGURED' && isNonEmptyText(value.message)
      ? { status: 'unavailable', code: value.code, message: value.message }
      : null;
  }
  if (!Array.isArray(value.invoices)) return null;

  const invoices: InvoiceHistoryRecord[] = [];
  const seen = new Set<string>();
  for (const item of value.invoices) {
    if (!isRecord(item)
      || !isNonEmptyText(item.id)
      || !isNonEmptyText(item.number)
      || typeof item.issuedAt !== 'string' || !toSafeInvoiceDateTime(item.issuedAt)
      || !isNonEmptyText(item.status)
      || typeof item.totalMinor !== 'number' || !Number.isSafeInteger(item.totalMinor) || item.totalMinor < 0
      || typeof item.currency !== 'string' || !/^[A-Za-z]{3}$/.test(item.currency.trim())
      || (item.hostedUrl !== undefined && item.hostedUrl !== null && typeof item.hostedUrl !== 'string')
      || seen.has(item.id)) return null;
    seen.add(item.id);
    invoices.push({
      id: item.id,
      number: item.number,
      issuedAt: item.issuedAt,
      status: item.status,
      totalMinor: item.totalMinor,
      currency: item.currency,
      ...(item.hostedUrl === undefined ? {} : { hostedUrl: item.hostedUrl as string | null }),
    });
  }
  return { status: 'ready', invoices };
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
  return toSafeDisplayDateTime(value);
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
