import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { CompatibilityMap } from "@/components/dashboard/compatibility-map";
import { ScanProgress } from "@/components/dashboard/scan-progress";
import { EventTimeline } from "@/components/ui/event-timeline";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  GitBranch,
  Search,
} from "lucide-react";

export default function DashboardOverviewPage() {

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Command Center Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 p-6 rounded-xl border border-zinc-800/90 shadow-xl font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            APIProof Command Center
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100 font-mono">
            Continuous Change Intelligence
          </h1>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Monitoring AST symbol invocations against reviewed API deprecations across 2 connected repositories.
          </p>
        </div>

        {/* High signal summary strip */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-0.5">
            <span className="text-[10px] text-zinc-500 block uppercase font-bold">Repositories</span>
            <span className="text-base font-bold text-zinc-100">2 Monitored</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-0.5">
            <span className="text-[10px] text-zinc-500 block uppercase font-bold">Integrations</span>
            <span className="text-base font-bold text-zinc-100">9 Detected</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-0.5">
            <span className="text-[10px] text-teal-400 block uppercase font-bold">Reviewed Rules</span>
            <span className="text-base font-bold text-teal-300">11 Active</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-0.5">
            <span className="text-[10px] text-rose-400 block uppercase font-bold">Active Risks</span>
            <span className="text-base font-bold text-rose-300">1 Finding</span>
          </div>
        </div>
      </div>

      {/* Main Split Layout: 65% Left / 35% Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN 65% (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Compatibility Graph Map */}
          <CompatibilityMap />

          {/* Scan Progress Simulator */}
          <ScanProgress />

          {/* Monitored Repositories Snapshot */}
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800">
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                Monitored Repositories Overview
              </CardTitle>
              <Link
                href="/dashboard/repositories"
                className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
              >
                View All Repos <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {demoData.repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/repositories/${repo.id}`}
                        className="font-bold text-sm text-zinc-100 hover:text-emerald-400 transition-colors"
                      >
                        {repo.name}
                      </Link>
                      <StatusPill
                        status={repo.status === "healthy" ? "healthy" : "pr_created"}
                        label={repo.statusLabel}
                      />
                    </div>
                    <div className="text-zinc-500 text-[11px] font-sans">
                      {repo.fullName} • Default branch: <code className="text-zinc-300">{repo.defaultBranch}</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
                    <div>
                      Usages: <strong className="text-zinc-200">{repo.usagesCount}</strong>
                    </div>
                    <div>
                      Providers: <strong className="text-zinc-200">{repo.providers.length}</strong>
                    </div>
                    <Link href={`/dashboard/repositories/${repo.id}`}>
                      <button className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition-colors">
                        Details
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN 35% (4 cols): Live Event Feed */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-sky-400" />
                Live Change Event Stream
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <EventTimeline events={demoData.activityEvents} />
            </CardContent>
          </Card>

          {/* Active Risk Summary Card */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-amber-400 font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Action Required (Draft PR #1)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs font-mono">
              <p className="text-zinc-300 font-sans text-xs">
                Stripe <code className="text-amber-300">coupon</code> parameter removal migration is verified.
              </p>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1 text-[11px]">
                <div className="text-zinc-400">Target file: <span className="text-emerald-400">src/billing.ts</span></div>
                <div className="text-zinc-400">Draft PR: <span className="text-cyan-300">#1 opened</span></div>
              </div>
              <Link href="/dashboard/findings/stripe-subscription-coupon-removed">
                <button className="w-full py-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold transition-colors">
                  Review Finding & Code Diff →
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
