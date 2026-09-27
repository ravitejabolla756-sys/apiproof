"use client";

import React from "react";

export function MigrationArtwork() {
  return (
    <div className="relative w-full aspect-[4/3] max-w-[580px] mx-auto flex items-center justify-center p-2 select-none">
      <div className="relative w-full h-full rounded-[28px] bg-white border border-[#E0EEFF] p-6 shadow-sm flex flex-col justify-between overflow-hidden">
        
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-[#F0F7FF] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_#0EA5E9]" />
            <span className="text-xs font-bold text-[#111111]">Verified Refactor Engine</span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
            PR #1 READY
          </span>
        </div>

        {/* Before / After Transformation Board */}
        <div className="relative w-full my-auto space-y-3">
          {/* Before Code Snippet */}
          <div className="rounded-xl bg-slate-900 text-slate-300 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1.5 border-b border-slate-800 pb-1">
              <span>BEFORE (stripe@16.2)</span>
              <span className="text-rose-400">Deprecated</span>
            </div>
            <pre className="font-mono text-[10px] text-slate-300">
              <code>{`const sub = await stripe.subscriptions.create({\n  customer: customerId,\n  coupon: 'DISCOUNT_20'\n});`}</code>
            </pre>
          </div>

          {/* Validation Badges Row */}
          <div className="flex items-center justify-center gap-2 font-mono text-[9px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Typecheck ✓
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              Tests ✓
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Contract Verified ✓
            </span>
          </div>

          {/* After Code Snippet */}
          <div className="rounded-xl bg-emerald-950 text-emerald-100 p-3.5 border border-emerald-800">
            <div className="flex items-center justify-between font-mono text-[10px] text-emerald-400 mb-1.5 border-b border-emerald-900 pb-1">
              <span>AFTER (stripe@17.4)</span>
              <span className="text-emerald-300">Verified Refactor</span>
            </div>
            <pre className="font-mono text-[10px] text-emerald-200">
              <code>{`const sub = await stripe.subscriptions.create({\n  customer: customerId,\n  discounts: [{ coupon: 'DISCOUNT_20' }]\n});`}</code>
            </pre>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between font-mono text-[10px] text-[#686868] pt-3 border-t border-[#F0F7FF]">
          <span>Automated safe PR generation</span>
          <span className="text-sky-700 font-semibold">Zero Breaking Changes</span>
        </div>
      </div>
    </div>
  );
}
