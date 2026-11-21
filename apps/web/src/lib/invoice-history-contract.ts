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

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readInvoiceErrorCode(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function invoiceHistoryErrorMessage(status: number, code: string | null): string {
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (status === 403 || status === 404 || code === 'WORKSPACE_ACCESS_DENIED') return 'Invoice history is unavailable for this workspace.';
  if (status === 503 || code === 'PROVIDER_NOT_CONFIGURED' || code === 'INVOICE_PROVIDER_UNAVAILABLE') {
    return 'Invoice history is temporarily unavailable.';
  }
  return 'Invoice history could not be loaded. Please try again.';
}

/** Validate a future server-owned invoice projection before it reaches the UI. */
export function parseInvoiceHistoryResult(value: unknown): InvoiceHistoryResult | null {
  if (!isRecord(value) || (value.status !== 'unavailable' && value.status !== 'ready')) return null;
  if (value.status === 'unavailable') {
    const message = normalizedText(value.message);
    return value.code === 'PROVIDER_NOT_CONFIGURED' && message
      ? { status: 'unavailable', code: value.code, message }
      : null;
  }
  if (!Array.isArray(value.invoices)) return null;

  const invoices: InvoiceHistoryRecord[] = [];
  const seen = new Set<string>();
  for (const item of value.invoices) {
    const id = isRecord(item) ? normalizedText(item.id) : null;
    const number = isRecord(item) ? normalizedText(item.number) : null;
    const status = isRecord(item) ? normalizedText(item.status) : null;
    const currency = isRecord(item) && typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : null;
    const hostedUrl = isRecord(item) && (item.hostedUrl === undefined || item.hostedUrl === null)
      ? item.hostedUrl
      : isRecord(item) && typeof item.hostedUrl === 'string'
        ? toSafeInvoiceUrl(item.hostedUrl)
        : undefined;
    if (!isRecord(item)
      || !id
      || !number
      || typeof item.issuedAt !== 'string' || !toSafeInvoiceDateTime(item.issuedAt)
      || !status
      || typeof item.totalMinor !== 'number' || !Number.isSafeInteger(item.totalMinor) || item.totalMinor < 0
      || !currency || !/^[A-Z]{3}$/.test(currency)
      || (item.hostedUrl !== undefined && item.hostedUrl !== null && typeof item.hostedUrl !== 'string')
      || seen.has(id)) return null;
    seen.add(id);
    invoices.push({
      id,
      number,
      issuedAt: item.issuedAt,
      status,
      totalMinor: item.totalMinor,
      currency,
      ...(hostedUrl === undefined ? {} : { hostedUrl }),
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
