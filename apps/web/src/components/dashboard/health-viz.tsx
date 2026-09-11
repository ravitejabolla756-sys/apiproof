'use client';

import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function HealthViz() {
  return (
    <div className="bg-[#12141c] border border-[#1f2333] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">API Compatibility Health</h3>
          <p className="text-xs text-zinc-400">Real-time status across indexed third-party SDKs</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>1 Deprecation Managed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400 font-mono">
          <span>Compatibility Index</span>
          <span className="text-zinc-200">96.8% Up-to-date</span>
        </div>
        <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 w-[90%]" title="Healthy / Up to date" />
          <div className="h-full bg-amber-500 w-[7%]" title="Pending Review" />
          <div className="h-full bg-sky-500 w-[3%]" title="Draft PR Created" />
        </div>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="bg-[#171a26] border border-[#222738] rounded-lg p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Healthy Repos</div>
            <div className="text-sm font-bold text-zinc-100 font-mono">1 / 2</div>
          </div>
        </div>

        <div className="bg-[#171a26] border border-[#222738] rounded-lg p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Open Findings</div>
            <div className="text-sm font-bold text-zinc-100 font-mono">1 Active</div>
          </div>
        </div>

        <div className="bg-[#171a26] border border-[#222738] rounded-lg p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Draft PRs</div>
            <div className="text-sm font-bold text-zinc-100 font-mono">PR #1 Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
}
