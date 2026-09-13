"use client";

import { DEMO_ACTIVITIES } from "@/lib/demo-data";
import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-700" />
          Workspace Audit Activity Log
        </h1>
        <p className="text-xs text-[#686868]">
          Complete chronological record of repository scans, indexings, findings, and pull requests.
        </p>
      </div>

      {/* ACTIVITY FEED */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
        <div className="divide-y divide-[#E8E8E5]">
          {DEMO_ACTIVITIES.map((act) => (
            <div key={act.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#111111]">{act.title}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F6F6F4] text-zinc-700 border border-[#E8E8E5] text-[10px] font-medium">
                    {act.badge}
                  </span>
                </div>
                <p className="text-xs text-[#686868] leading-relaxed">
                  {act.description}
                </p>
              </div>

              <div className="text-right text-[11px] text-[#686868] font-mono shrink-0">
                {act.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
