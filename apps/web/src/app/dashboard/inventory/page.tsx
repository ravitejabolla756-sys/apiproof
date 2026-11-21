"use client";

import { useEffect, useRef, useState } from "react";
import { ProviderBadge } from "@/components/ui/status-pill";
import { Search, Boxes, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseInventoryResponse, type ProviderInventoryItem } from "@/lib/inventory-contract";

export default function ApiInventoryPage() {
  const [providers, setProviders] = useState<ProviderInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("API provider registry is temporarily unavailable.");
      const parsed = parseInventoryResponse(await res.json());
      if (!parsed) throw new Error("API provider registry returned an invalid response.");
      setProviders(parsed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "API provider registry is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const items = providers.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.rules.some((r) => r.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-700" />
            API Inventory & Rule Registry
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Server-registered third-party API SDK breaking change rules evaluated during AST repository scans.
          </p>
        </div>

        <Button
          type="button"
          onClick={loadInventory}
          disabled={loading}
          aria-busy={loading ? "true" : undefined}
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* SEARCH */}
      <div className="relative w-full sm:w-80">
        <Search aria-hidden="true" className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
        <input
          type="text"
          aria-label="Filter provider integrations"
          placeholder="Filter provider integrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
        />
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="py-20 text-center text-[#686868]">
          <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading API provider registry...</span>
        </div>
      ) : (
        <>
          {error && <div ref={errorRef} role="alert" aria-live="assertive" tabIndex={-1} className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2">{error} Use Refresh to try again.</div>}
          {!error && items.length === 0 ? <p role="status" aria-live="polite" className="py-20 text-center text-[#686868]">No provider integrations match this filter.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-[24px] bg-white border border-[#E8E8E5] space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <ProviderBadge name={item.name} status={item.status} />
                <span className="text-[10px] text-[#686868] uppercase font-semibold tracking-wider">
                  {item.category}
                </span>
              </div>

              <p className="text-xs text-[#686868] leading-relaxed">
                {item.description}
              </p>

              <div className="flex flex-wrap items-center gap-1.5" aria-label="Provider capabilities">
                {(item.capabilities ?? (item.capability ? [item.capability] : [])).map((capability) => (
                  <span key={capability} className="rounded-full border border-[#E8E8E5] bg-[#F6F6F4] px-2 py-0.5 text-[10px] font-medium text-[#686868]">
                    {capability}
                  </span>
                ))}
              </div>

              <div className="pt-3 border-t border-[#E8E8E5] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#686868] font-medium flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-purple-700" />
                    Active Rule Coverage
                  </span>
                  <span className="font-semibold text-[#111111] bg-purple-50 text-purple-800 px-2.5 py-0.5 rounded-full text-[11px] border border-purple-200">
                    {item.rulesCount} registered rules
                  </span>
                </div>

                <div className="space-y-2">
                  {item.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-[#111111]">
                          {rule.id}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {rule.severity}
                        </span>
                      </div>
                      <div className="font-medium text-[#111111]">{rule.title}</div>
                      <p className="text-[11px] text-[#686868] leading-normal">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            ))}
          </div>}
        </>
      )}
    </div>
  );
}
