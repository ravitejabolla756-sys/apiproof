"use client";

import { useEffect, useState } from "react";
import { ProviderBadge } from "@/components/ui/status-pill";
import { Search, Boxes, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import { parseInventoryResponse, type ProviderInventoryProjection } from "@/lib/inventory-contract";

type ProviderInventoryItem = ProviderInventoryProjection;

export default function ApiInventoryPage() {
  const [providers, setProviders] = useState<ProviderInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadInventory() {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const json = await res.json() as unknown;
      const parsed = parseInventoryResponse(json);
      if (!res.ok || !parsed) {
        const error = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : undefined;
        throw new Error(error || "Unable to load API inventory.");
      }
      setProviders(parsed);
      setError(null);
    } catch (err) {
      console.error("Failed to load API inventory:", err);
      setError(err instanceof Error ? err.message : "Unable to load API inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const items = providers.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.rules.some((r) => r.title.toLowerCase().includes(search.toLowerCase()))
  );
  const hasActiveFilter = search.trim().length > 0;

  return (
    <div aria-busy={loading ? 'true' : undefined} className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <Boxes aria-hidden="true" className="w-6 h-6 text-purple-700" />
            API Inventory & Rule Registry
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Server-registered third-party API SDK breaking change rules evaluated during AST repository scans.
          </p>
        </div>

        <Button
          onClick={loadInventory}
          variant="outline"
          size="sm"
          disabled={loading}
          aria-busy={loading ? 'true' : undefined}
          icon={<RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
          className="min-h-11 font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {error && <DashboardDataError message={error} onRetry={() => void loadInventory()} busy={loading} />}

      {/* SEARCH */}
      <div className="relative w-full sm:w-80">
        <Search aria-hidden="true" className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
        <input
          type="text"
          aria-label="Filter provider integrations"
          placeholder="Filter provider integrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
        />
      </div>

      {error ? null : loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="py-20 text-center text-[#686868]">
          <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading API provider registry...</span>
        </div>
      ) : items.length === 0 ? (
        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-[28px] border border-[#E8E8E5] bg-white p-12 text-center text-[#686868]">
          <Boxes aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-purple-700" />
          <p className="font-semibold text-base text-[#111111]">{providers.length === 0 ? "No API inventory records are available yet" : "No provider rules match this filter"}</p>
          <p className="mt-2 text-xs">{providers.length === 0 ? "Provider rules will appear here when the reviewed registry is available." : "Try a different provider or rule search."}</p>
          {hasActiveFilter && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSearch("")} className="mt-4 min-h-11">
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Provider capabilities">
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
        </div>
      )}
    </div>
  );
}
