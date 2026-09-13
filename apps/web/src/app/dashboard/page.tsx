"use client";

import Link from "next/link";
import { DEMO_REPOSITORIES, DEMO_FINDING_STRIPE, DEMO_ACTIVITIES } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { CompatibilityMap } from "@/components/dashboard/compatibility-map";
import { ArrowUpRight, AlertTriangle, GitBranch, ArrowRight, CheckCircle2 } from "lucide-react";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8 font-sans">
      {/* WELCOME BANNER (EDITORIAL) */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#686868]">
              DEMO WORKSPACE
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-[#111111]">
              Welcome back.
            </h1>
            <p className="text-xs sm:text-sm text-[#686868] mt-1">
              2 repositories monitored · 9 provider integrations detected · 1 finding needs review
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/findings/fnd-1">
              <Button size="sm" className="gap-2 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Review Stripe Finding</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* EDITORIAL SPLIT: LEFT 65% / RIGHT 35% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT 65%: REPOSITORIES REQUIRING ATTENTION & MONITORED TABLE */}
        <div className="lg:col-span-8 space-y-6">

          {/* CRITICAL FINDING ROW */}
          <div className="rounded-[24px] bg-[#FEF8EC] border border-[#FDE68A] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-amber-950">Action Required</span>
                <span className="text-xs text-amber-700">·</span>
                <span className="text-xs text-amber-800">apiproof-github-fixture</span>
              </div>
              <StatusPill status="pr_created" label="Draft PR #1" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-[#111111]">
                {DEMO_FINDING_STRIPE.title}
              </h3>
              <p className="text-xs text-[#686868] leading-relaxed">
                Stripe Node SDK v17 removed top-level <code className="bg-white px-1.5 py-0.5 rounded border border-[#E8E8E5] font-mono text-[11px]">coupon</code> parameter. Refactored to <code className="bg-white px-1.5 py-0.5 rounded border border-[#E8E8E5] font-mono text-[11px]">discounts</code> array in <code className="font-mono text-[11px]">src/billing.ts</code>.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>4/4 verification gates passed</span>
              </div>
              <Link href="/dashboard/findings/fnd-1">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-white">
                  <span>Inspect Finding & PR</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* MONITORED REPOSITORIES TABLE */}
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-700" />
                Monitored Repositories
              </h3>
              <Link href="/dashboard/repositories" className="text-xs text-[#686868] hover:text-[#111111] font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#E8E8E5]">
              {DEMO_REPOSITORIES.map((repo) => (
                <div key={repo.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/repositories/${repo.id}`} className="text-sm font-semibold text-[#111111] hover:underline font-mono">
                        {repo.name}
                      </Link>
                      <StatusPill
                        status={repo.status === 'healthy' ? 'healthy' : 'pr_created'}
                        label={repo.statusLabel}
                      />
                    </div>
                    <div className="text-xs text-[#686868]">
                      {repo.totalFiles} files · Primary: <span className="font-mono text-[11px] text-[#111111]">{repo.primarySdk || 'Multi-SDK'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs hidden sm:block">
                      <div className="text-[#111111] font-medium">{repo.providers.length} integrations</div>
                      <div className="text-[#686868] text-[11px]">{repo.lastScanAt}</div>
                    </div>
                    <Link href={`/dashboard/repositories/${repo.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT 35%: RECENT ACTIVITY */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111111]">Recent Activity</h3>
              <Link href="/dashboard/activity" className="text-xs text-[#686868] hover:text-[#111111] font-medium">
                History
              </Link>
            </div>

            <div className="space-y-3 font-sans text-xs">
              {DEMO_ACTIVITIES.slice(0, 4).map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                  <div className="flex items-center justify-between text-[#111111] font-medium">
                    <span className="truncate">{act.title}</span>
                    <span className="text-[10px] text-[#686868] shrink-0">{act.timestamp.split(' ')[1]}</span>
                  </div>
                  <p className="text-[11px] text-[#686868] leading-relaxed">
                    {act.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM: REPOSITORY COMPATIBILITY MAP */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111111]">Repository Compatibility Map</h3>
            <p className="text-xs text-[#686868]">Topology visualization of vendor API change rules mapped to monitored repository symbols.</p>
          </div>
        </div>

        <CompatibilityMap />
      </div>

    </div>
  );
}
