"use client";

import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";

export default function InventoryPage() {
  return (
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      {/* Header Bar */}
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          API inventory
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Catalog of detected third-party API dependencies and reviewed change intelligence coverage.
        </p>
      </div>

      {/* Single Clean Data Table */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800/80 text-zinc-400 text-[11px] font-medium">
              <th className="py-2.5 px-4 font-medium">Provider</th>
              <th className="py-2.5 px-4 font-medium">Category</th>
              <th className="py-2.5 px-4 font-medium">Repositories</th>
              <th className="py-2.5 px-4 font-medium">SDK</th>
              <th className="py-2.5 px-4 font-medium">Intelligence</th>
              <th className="py-2.5 px-4 font-medium text-right">Usages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-xs">
            {demoData.providerRegistry.map((p) => {
              const isTwilio = p.name === "Twilio";
              const isStripe = p.name === "Stripe";
              const isReviewed = p.status === "REVIEWED";

              return (
                <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-zinc-100">{p.name}</td>
                  <td className="py-3 px-4 text-zinc-400">{p.category}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                    {isStripe ? "apiproof-github-fixture" : "Bavio-Ai-v1"}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    {isTwilio ? "^5.12.2" : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <StatusPill
                      status={isReviewed ? "reviewed" : "detected"}
                      label={isReviewed ? "Reviewed" : "Detected"}
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    {isTwilio ? (
                      <span className="text-zinc-200">27 usages</span>
                    ) : isStripe ? (
                      <span className="text-amber-400">1 affected</span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
