"use client";

import Link from "next/link";
import { DEMO_FINDING_STRIPE } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowUpRight, CheckCircle2, GitPullRequest } from "lucide-react";

export default function FindingsListPage() {
  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-rose-600" />
          API Compatibility Findings
        </h1>
        <p className="text-xs text-[#686868]">
          Detected breaking changes matching indexed repository AST call sites.
        </p>
      </div>

      {/* FINDING ROW CARD */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs hover:border-[#111111]/30 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold">
                Stripe
              </span>
              <h2 className="text-lg font-semibold text-[#111111]">
                {DEMO_FINDING_STRIPE.title}
              </h2>
            </div>
            <p className="text-xs text-[#686868] leading-relaxed">
              {DEMO_FINDING_STRIPE.description}
            </p>
          </div>

          <StatusPill status="verified" label="Migration Verified" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Repository</div>
            <div className="font-mono text-[#111111] font-semibold">{DEMO_FINDING_STRIPE.repositoryName}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Affected File</div>
            <div className="font-mono text-[#111111] font-semibold">{DEMO_FINDING_STRIPE.affectedFile}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Matched Symbol</div>
            <div className="font-mono text-purple-700 font-semibold">{DEMO_FINDING_STRIPE.symbol}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
            <div className="text-[10px] text-[#686868] uppercase font-semibold">Verification</div>
            <div className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 4/4 Passed
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#E8E8E5] flex items-center justify-between text-xs">
          <span className="text-[#686868] flex items-center gap-1.5 font-medium">
            <GitPullRequest className="w-4 h-4 text-blue-600" />
            Draft PR #1 Created
          </span>
          <Link href={`/dashboard/findings/${DEMO_FINDING_STRIPE.id}`}>
            <Button size="sm" variant="primary" className="gap-1 text-xs">
              <span>Inspect Workbench & Diff</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}
