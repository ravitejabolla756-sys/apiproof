"use client";

import { useState } from "react";
import { DEMO_INVENTORY } from "@/lib/demo-data";
import { ProviderBadge } from "@/components/ui/status-pill";
import { Search, Boxes } from "lucide-react";

export default function ApiInventoryPage() {
  const [search, setSearch] = useState("");

  const items = DEMO_INVENTORY.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">

      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <Boxes className="w-6 h-6 text-purple-700" />
          API Inventory & Integrations
        </h1>
        <p className="text-xs text-[#686868]">
          Detected third-party SDK dependencies and reviewed vendor API compatibility rule coverage.
        </p>
      </div>

      {/* SEARCH */}
      <div className="relative w-full sm:w-80">
        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter provider integrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
        />
      </div>

      {/* GRID OF PROVIDERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-[24px] bg-white border border-[#E8E8E5] space-y-4 shadow-xs hover:border-[#111111]/30 transition-all"
          >
            <div className="flex items-center justify-between">
              <ProviderBadge name={item.name} status={item.status} />
              <span className="text-[10px] text-[#686868] uppercase font-semibold">{item.category}</span>
            </div>

            <div className="pt-2 border-t border-[#E8E8E5] flex items-center justify-between text-xs">
              <span className="text-[#686868]">Rules Status</span>
              <span className="font-semibold text-[#111111]">
                {item.status === "reviewed" ? `${item.rulesCount} active rules` : "Auto-detected"}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
