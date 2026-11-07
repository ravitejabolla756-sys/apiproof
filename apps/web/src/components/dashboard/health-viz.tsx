'use client';

import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function HealthViz() {
  return (
    <div className="bg-white border border-[#E8E8E5] rounded-[24px] p-6 space-y-4 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#111111]">API Compatibility Health</h3>
          <p className="text-xs text-[#686868]">Status across indexed third-party SDK dependencies</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-800 bg-[#EEF7F2] border border-[#D1EBE0] px-3 py-1 rounded-full font-medium">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
          <span>1 Deprecation Managed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-[#686868] font-sans font-medium">
          <span>Compatibility Index</span>
          <span className="text-[#111111] font-semibold">96.8% Up-to-date</span>
        </div>
        <div className="h-2.5 w-full bg-[#F6F6F4] rounded-full overflow-hidden flex border border-[#E8E8E5]">
          <div className="h-full bg-emerald-500 w-[90%]" title="Healthy / Up to date" />
          <div className="h-full bg-amber-500 w-[7%]" title="Pending Review" />
          <div className="h-full bg-blue-500 w-[3%]" title="Repository Writes Disabled" />
        </div>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="bg-[#F6F6F4] border border-[#E8E8E5] rounded-xl p-3.5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#EEF7F2] border border-[#D1EBE0] flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Healthy Repos</div>
            <div className="text-xs font-bold text-[#111111] font-mono">1 / 2</div>
          </div>
        </div>

        <div className="bg-[#F6F6F4] border border-[#E8E8E5] rounded-xl p-3.5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#FEF8EC] border border-[#FDE68A] flex items-center justify-center text-amber-700 shrink-0">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Open Findings</div>
            <div className="text-xs font-bold text-[#111111] font-mono">1 Active</div>
          </div>
        </div>

        <div className="bg-[#F6F6F4] border border-[#E8E8E5] rounded-xl p-3.5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#EBF3FC] border border-[#C6E1FA] flex items-center justify-center text-blue-700 shrink-0">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Repository writes</div>
            <div className="text-xs font-bold text-[#111111] font-mono">PR #1 Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
}
