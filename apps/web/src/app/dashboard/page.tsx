import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { CompatibilityMap } from "@/components/dashboard/compatibility-map";
import { EventTimeline } from "@/components/ui/event-timeline";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8 max-w-7xl font-sans">
      {/* Top Section: Compact Textual Overview */}
      <div className="space-y-2 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Workspace overview
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium">
            Demo workspace
          </span>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400">
          2 repositories monitored · 9 detected integrations · 1 finding requiring attention
        </p>
      </div>

      {/* Prominent Finding Review Row (Stripe Issue) */}
      <div className="p-4 rounded-lg bg-zinc-900/80 border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100">1 finding requires review</span>
              <StatusPill status="affected" label="Stripe" />
            </div>
            <p className="text-zinc-400">
              Subscription coupon parameter removed in <code className="font-mono text-zinc-300">apiproof-github-fixture</code> (<span className="font-mono text-zinc-300">src/billing.ts</span>). Migration verified.
            </p>
          </div>
        </div>

        <Link href="/dashboard/findings/stripe-subscription-coupon-removed">
          <Button size="sm" className="bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800/60 shrink-0 text-xs">
            Review finding <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Main Split Layout: Left 70% / Right 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN 70% (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Repositories Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">Monitored repositories</h2>
              <Link href="/dashboard/repositories" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                View all →
              </Link>
            </div>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800/80">
                  <tr>
                    <th className="px-4 py-3 font-medium">Repository</th>
                    <th className="px-4 py-3 font-medium">Providers</th>
                    <th className="px-4 py-3 font-medium">Usages</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {demoData.repositories.map((repo) => (
                    <tr key={repo.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/repositories/${repo.id}`} className="font-semibold text-zinc-200 hover:text-blue-400">
                          {repo.name}
                        </Link>
                        <div className="text-[11px] text-zinc-500 font-mono">{repo.fullName}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 font-sans">
                        {repo.providers.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 font-mono">
                        {repo.usagesCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          status={repo.status === "healthy" ? "healthy" : "affected"}
                          label={repo.statusLabel}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/repositories/${repo.id}`} className="text-xs text-zinc-400 hover:text-zinc-100 font-medium">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compatibility Graph Map */}
          <CompatibilityMap />
        </div>

        {/* RIGHT COLUMN 30% (4 cols): Recent Activity Feed */}
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-100">Recent API activity</h2>
            <p className="text-xs text-zinc-500">System activity stream</p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
            <EventTimeline events={demoData.activityEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
