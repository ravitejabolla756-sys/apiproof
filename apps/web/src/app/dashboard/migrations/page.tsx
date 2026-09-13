"use client";

import { DEMO_VERIFICATION_CHECKS, DEMO_PULL_REQUEST } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { FileCheck2, CheckCircle2, GitPullRequest } from "lucide-react";

export default function MigrationsWorkbenchPage() {
  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">

      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <FileCheck2 className="w-6 h-6 text-emerald-600" />
          Verified Migrations Workbench
        </h1>
        <p className="text-xs text-[#686868]">
          AST code transformations validated against 4-gate verification pipelines before opening review-only PRs.
        </p>
      </div>

      {/* MIGRATION WORKBENCH PANEL */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px]">
                Stripe Migration
              </span>
              <h2 className="text-lg font-semibold text-[#111111]">
                stripe-subscription-coupon-removed
              </h2>
            </div>
            <div className="text-xs text-[#686868] mt-1 font-mono">
              Target file: src/billing.ts · Repo: apiproof-github-fixture
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill status="verified" label="4/4 Gates Passed" />
            <StatusPill status="pr_created" label="Draft PR #1" />
          </div>
        </div>

        {/* WORKBENCH SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          {/* CODE DIFF ON LEFT (60%) */}
          <div className="lg:col-span-7 bg-[#F6F6F4] rounded-[24px] border border-[#E8E8E5] p-5 space-y-3 flex flex-col justify-between">
            <div className="text-xs font-semibold text-[#111111] flex items-center justify-between">
              <span>AST Transformation Output</span>
              <span className="font-mono text-[11px] text-[#686868]">src/billing.ts</span>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100 space-y-2">
              <div className="text-zinc-500 text-[11px]">// Before Refactor</div>
              <div className="text-rose-400 bg-rose-950/60 p-2 rounded border border-rose-900/50">
                coupon: couponId
              </div>
              <div className="text-zinc-500 text-[11px] pt-1">// After Refactor (Stripe SDK v17+)</div>
              <div className="text-emerald-400 bg-emerald-950/60 p-2 rounded border border-emerald-900/50">
                discounts: [{`{ coupon: couponId }`}]
              </div>
            </div>
          </div>

          {/* VERIFICATION INSPECTOR ON RIGHT (40%) */}
          <div className="lg:col-span-5 bg-[#EEF7F2] rounded-[24px] border border-[#D1EBE0] p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verification Inspector
              </div>
              <p className="text-[11px] text-emerald-800">
                Passed all 4 AST and test suite compilation gates.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              {DEMO_VERIFICATION_CHECKS.map((chk) => (
                <div key={chk.id} className="p-3 rounded-xl bg-white border border-[#D1EBE0] flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="font-semibold text-[#111111]">{chk.name}</div>
                    <div className="text-[11px] text-[#686868]">{chk.detail}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#D1EBE0] flex items-center justify-between">
              <a href={DEMO_PULL_REQUEST.url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="primary" className="gap-1.5 text-xs font-medium">
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Review Draft PR #1</span>
                </Button>
              </a>
              <span className="text-[11px] font-semibold text-emerald-900">Human Review Required</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
