import { describe, expect, it } from 'vitest';
import { unavailableInvoiceHistoryAdapter } from '../apps/web/src/lib/invoice-history-contract.js';

describe('invoice history adapter boundary', () => {
  it('keeps invoice history explicitly unavailable until a provider projection is configured', async () => {
    await expect(unavailableInvoiceHistoryAdapter.load()).resolves.toEqual({
      status: 'unavailable',
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'Invoice history is unavailable in the free beta. No provider-backed invoices or paid entitlements are represented here.',
    });
  });
});
