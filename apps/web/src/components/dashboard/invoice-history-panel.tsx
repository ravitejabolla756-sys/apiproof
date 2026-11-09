'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { toSafeInvoiceUrl, unavailableInvoiceHistoryAdapter, type InvoiceHistoryAdapter, type InvoiceHistoryRecord, type InvoiceHistoryResult } from '@/lib/invoice-history-contract';

function formatAmount(invoice: InvoiceHistoryRecord): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: invoice.currency.toUpperCase(),
  }).format(invoice.totalMinor / 100);
}

export function InvoiceHistoryPanel({ adapter = unavailableInvoiceHistoryAdapter }: { adapter?: InvoiceHistoryAdapter }) {
  const [result, setResult] = useState<InvoiceHistoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await adapter.load());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Invoice history is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-labelledby="invoice-history-heading" className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-3 shadow-xs">
      <div className="flex items-center gap-2">
        <Receipt aria-hidden="true" className="w-4 h-4 text-purple-700" />
        <h3 id="invoice-history-heading" className="text-base font-semibold text-[#111111]">Invoice history</h3>
      </div>
      {loading ? (
        <p role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-4 text-xs text-[#686868]">Loading invoice history…</p>
      ) : error ? (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} disabled={loading} aria-busy={loading ? 'true' : undefined} className="inline-flex min-h-11 items-center rounded-lg border border-rose-300 bg-white px-3 font-medium text-rose-900 disabled:cursor-not-allowed disabled:opacity-70">Retry invoice history</button>
        </div>
      ) : result?.status === 'unavailable' ? (
        <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">{result.message}</p>
      ) : result?.invoices.length === 0 ? (
        <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-4 text-xs text-[#686868]">No invoices are available for this workspace.</p>
      ) : (
        <div role="region" aria-label="Invoice history table" tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset">
          <table className="w-full min-w-[38rem] text-left text-xs">
            <thead><tr className="border-b border-[#E8E8E5] text-[#686868]"><th scope="col" className="pb-3 font-medium">Invoice</th><th scope="col" className="pb-3 font-medium">Issued</th><th scope="col" className="pb-3 font-medium">Status</th><th scope="col" className="pb-3 text-right font-medium">Total</th><th scope="col" className="pb-3 text-right font-medium"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{result?.invoices.map((invoice) => { const safeHostedUrl = toSafeInvoiceUrl(invoice.hostedUrl); return <tr key={invoice.id} className="border-b border-[#E8E8E5] last:border-0"><th scope="row" className="py-4 font-medium text-[#333333]">{invoice.number}</th><td className="py-4 text-[#686868]"><time dateTime={invoice.issuedAt}>{new Date(invoice.issuedAt).toLocaleDateString()}</time></td><td className="py-4 capitalize text-[#686868]">{invoice.status}</td><td className="py-4 text-right font-mono text-[#333333]">{formatAmount(invoice)}</td><td className="py-4 text-right">{safeHostedUrl ? <a href={safeHostedUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-[#0050F8] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]">View invoice</a> : <span className="text-[#686868]">Unavailable</span>}</td></tr>; })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
