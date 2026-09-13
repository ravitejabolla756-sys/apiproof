"use client";

import React from "react";
import { CheckCircle2, ArrowRight, Code2, Database } from "lucide-react";

export function HeroScanViz() {
  return (
    <div className="relative w-full aspect-square max-w-[540px] mx-auto flex items-center justify-center p-4 sm:p-6 select-none">
      {/* Soft pastel ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-200/40 via-sky-100/60 to-emerald-100/40 blur-3xl opacity-70 pointer-events-none" />

      {/* Main Glassmorphic Central Trace Container */}
      <div className="relative w-full h-full rounded-[32px] bg-white/70 backdrop-blur-xl border border-white/80 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
        {/* Subtle decorative background grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* TOP ROW: Vendor API Change Node */}
        <div className="relative z-10 flex items-center justify-between bg-white/90 rounded-2xl p-4 border border-[#E8E8E5] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-semibold text-xs shadow-2xs">
              Stripe
            </div>
            <div>
              <div className="text-xs font-semibold text-[#111111]">
                subscriptions.create
              </div>
              <div className="text-[11px] text-amber-700 font-mono">
                coupon parameter removed in v17+
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
            API Deprecation
          </span>
        </div>

        {/* MIDDLE SECTION: Animated Trace Lines & Nodes */}
        <div className="relative z-10 py-6 my-auto flex flex-col items-center justify-center space-y-4">
          {/* Trace Connection Path SVG */}
          <div className="relative w-full h-24 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 400 100" fill="none">
              <path
                d="M 50 10 C 150 90, 250 10, 350 90"
                stroke="url(#traceGradient)"
                strokeWidth="3"
                strokeDasharray="6 6"
                className="animate-[dash_20s_linear_infinite]"
              />
              <defs>
                <linearGradient id="traceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A855F7" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Floating Glass Node 1: Symbol Trace */}
            <div className="absolute top-2 left-6 bg-white/90 backdrop-blur-md rounded-xl px-3 py-2 border border-purple-100 shadow-md flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] font-mono text-zinc-800">AST Trace</span>
            </div>

            {/* Floating Glass Node 2: Source File */}
            <div className="absolute bottom-2 right-8 bg-white/90 backdrop-blur-md rounded-xl px-3.5 py-2 border border-sky-100 shadow-md flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[11px] font-mono text-zinc-800">src/billing.ts:42</span>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Verification & Status */}
        <div className="relative z-10 bg-[#EEF7F2] rounded-2xl p-4 border border-[#D1EBE0] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                <span>Migration Verified</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">4/4 Gates</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-mono">
                Draft PR #1 ready for human review
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-700" />
        </div>
      </div>
    </div>
  );
}
