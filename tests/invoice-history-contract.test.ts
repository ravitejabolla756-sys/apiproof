import { describe, expect, it } from 'vitest';
import { formatInvoiceAmount, formatInvoiceDate, toSafeInvoiceDateTime, toSafeInvoiceUrl, unavailableInvoiceHistoryAdapter } from '../apps/web/src/lib/invoice-history-contract.js';

describe('invoice history adapter boundary', () => {
  it('keeps invoice history explicitly unavailable until a provider projection is configured', async () => {
    await expect(unavailableInvoiceHistoryAdapter.load()).resolves.toEqual({
      status: 'unavailable',
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'Invoice history is unavailable in the free beta. No provider-backed invoices or paid entitlements are represented here.',
    });
  });

  it('only permits credential-free HTTPS hosted invoice links', () => {
    expect(toSafeInvoiceUrl('https://billing.example.test/invoices/in_123')).toBe('https://billing.example.test/invoices/in_123');
    expect(toSafeInvoiceUrl('http://billing.example.test/invoices/in_123')).toBeNull();
    expect(toSafeInvoiceUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeInvoiceUrl('https://user:secret@billing.example.test/invoices/in_123')).toBeNull();
    expect(toSafeInvoiceUrl('/invoices/in_123')).toBeNull();
  });

  it('fails closed for malformed amount or currency projections', () => {
    expect(formatInvoiceAmount({ totalMinor: 1250, currency: ' usd ' })).toMatch(/12\.50/);
    expect(formatInvoiceAmount({ totalMinor: Number.NaN, currency: 'USD' })).toBe('Unavailable');
    expect(formatInvoiceAmount({ totalMinor: 1250, currency: 'US' })).toBe('Unavailable');
  });

  it('fails closed for malformed issue dates', () => {
    expect(toSafeInvoiceDateTime('2026-11-09T00:00:00.000Z')).toBe('2026-11-09T00:00:00.000Z');
    expect(toSafeInvoiceDateTime('not-a-date')).toBeNull();
    expect(toSafeInvoiceDateTime('2026-02-31T00:00:00.000Z')).toBeNull();
    expect(formatInvoiceDate('not-a-date')).toBe('Unavailable');
  });
});
