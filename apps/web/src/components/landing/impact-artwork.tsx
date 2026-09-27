"use client";

import React from "react";

export function ImpactArtwork() {
  return (
    <div className="relative w-full aspect-[4/3] max-w-[580px] mx-auto flex items-center justify-center p-2 select-none">
      <div className="relative w-full h-full rounded-[28px] bg-white border border-[#E8E8E5] p-6 shadow-sm flex flex-col justify-between overflow-hidden">
        
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
            <span className="text-xs font-bold text-[#111111]">AST Trace Visualizer</span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            AFFECTED (1/1)
          </span>
        </div>

        {/* Trace Flow Diagram SVG */}
        <div className="relative w-full h-[240px] my-auto flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 500 240" fill="none">
            <path
              d="M 90 60 C 190 60, 180 150, 270 150 C 350 150, 340 210, 420 210"
              stroke="#10B981"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle r="4.5" fill="#10B981">
              <animateMotion
                path="M 90 60 C 190 60, 180 150, 270 150 C 350 150, 340 210, 420 210"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          {/* Node 1: Vendor API Change */}
          <div className="absolute left-[10px] top-[10px] bg-[#FAFBFD] border border-[#E8E8E5] rounded-2xl p-3 w-[160px] shadow-xs">
            <div className="font-mono text-[10px] text-rose-600 font-semibold">VENDOR DEPRECATION</div>
            <div className="text-xs font-bold text-[#111111] mt-0.5">stripe.subscriptions</div>
            <div className="font-mono text-[10px] text-slate-500 line-through">coupon parameter</div>
          </div>

          {/* Node 2: AST Trace Resolver */}
          <div className="absolute left-[180px] top-[110px] bg-[#111111] text-white rounded-2xl p-3 w-[170px] shadow-md">
            <div className="font-mono text-[10px] text-emerald-400 font-medium">AST Trace Resolver</div>
            <div className="font-mono text-xs font-semibold mt-0.5">subscriptions.create</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Exact parameter match</div>
          </div>

          {/* Node 3: Refactored Code Diff */}
          <div className="absolute right-[10px] top-[150px] bg-slate-950 text-slate-100 rounded-2xl p-3 w-[190px] shadow-lg border border-slate-800">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 pb-1 mb-1.5 border-b border-slate-800">
              <span>src/billing.ts</span>
              <span className="text-emerald-400">L42</span>
            </div>
            <div className="font-mono text-[10px] space-y-1">
              <div className="text-rose-400 bg-rose-950/40 -mx-1 px-1 rounded">- coupon: couponId</div>
              <div className="text-emerald-400 bg-emerald-950/40 -mx-1 px-1 rounded">+ discounts: [couponId]</div>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between font-mono text-[10px] text-[#686868] pt-3 border-t border-[#F0F0F0]">
          <span>Deterministic AST Call Site Parsing</span>
          <span className="text-emerald-700 font-semibold">Zero Keyword Guessing</span>
        </div>
      </div>
    </div>
  );
}
