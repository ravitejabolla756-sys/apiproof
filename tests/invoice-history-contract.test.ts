import { describe, expect, it } from 'vitest';
import { toSafeInvoiceUrl, unavailableInvoiceHistoryAdapter } from '../apps/web/src/lib/invoice-history-contract.js';

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
});
