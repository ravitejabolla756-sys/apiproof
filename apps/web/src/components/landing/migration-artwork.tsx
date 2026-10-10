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
            <span className="text-xs font-bold text-[#111111]">Compatibility Proof</span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
            REVIEW READY
          </span>
        </div>

          {/* Evidence review board */}
        <div className="relative w-full my-auto space-y-3">
          {/* Before Code Snippet */}
          <div className="rounded-xl bg-slate-900 text-slate-300 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1.5 border-b border-slate-800 pb-1">
              <span>USAGE (src/index.ts:8)</span>
              <span className="text-rose-400">Affected</span>
            </div>
            <pre className="font-mono text-[10px] text-slate-300">
              <code>{`await client.responses.create({\n  model: 'gpt-4.5-preview',\n  input: 'review usage'\n});`}</code>
            </pre>
          </div>

          {/* Evidence badges */}
          <div className="flex items-center justify-center gap-2 font-mono text-[9px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Reviewed rule ✓
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              Source location ✓
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Reason code ✓
            </span>
          </div>

          {/* Human remediation boundary */}
          <div className="rounded-xl bg-emerald-950 text-emerald-100 p-3.5 border border-emerald-800">
            <div className="flex items-center justify-between font-mono text-[10px] text-emerald-400 mb-1.5 border-b border-emerald-900 pb-1">
              <span>HUMAN REVIEW</span>
              <span className="text-emerald-300">No repository write</span>
            </div>
            <pre className="font-mono text-[10px] text-emerald-200">
              <code>{`status: 'AFFECTED'\nchange: 'model retired'\nnext: 'choose remediation'`}</code>
            </pre>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between font-mono text-[10px] text-[#686868] pt-3 border-t border-[#F0F7FF]">
          <span>Detection-only beta</span>
          <span className="text-sky-700 font-semibold">Evidence linked</span>
        </div>
      </div>
    </div>
  );
}
