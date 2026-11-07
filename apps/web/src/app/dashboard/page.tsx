"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { CompatibilityMap } from "@/components/dashboard/compatibility-map";
import { ArrowUpRight, AlertTriangle, GitBranch, ArrowRight, CheckCircle2, RefreshCw, Plus, Loader2, ShieldCheck, ScanLine, ExternalLink } from "lucide-react";
import { ConnectRepoModal } from "@/components/dashboard/connect-repo-modal";

interface OverviewData {
  workspace?: {
    id: string;
    name: string;
    slug: string;
    role: string;
    repositoryCount: number;
    scanCount: number;
    openFindingCount: number;
    hasGitHubInstallation?: boolean;
    installationStatus?: string;
    installationAccount?: string | null;
  };
  stats: {
    connectedRepositories: number;
    scansCompleted: number;
    openFindings: number;
    criticalFindings: number;
    draftPrsCount: number;
    providerRulesPending: number;
    providerRulesApproved: number;
    rescansPending: number;
    rescansProcessing: number;
    rescansFailed: number;
  };
  repositories: Array<{
    id: string;
    name: string;
    owner: string;
    full_name: string;
    default_branch: string;
    status: string;
    last_scan_at: string | null;
    findings_count: number;
  }>;
  criticalFinding: {
    id: string;
    title: string;
    description: string;
    severity: string;
    symbol: string;
    file_path: string;
    status: string;
    repo_name: string;
    repo_full_name: string;
  } | null;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    created_at: string;
    repo_name: string | null;
  }>;
  recentProviderChanges: Array<{
    id: string;
    provider_id: string;
    title: string;
    description: string;
    source_url: string;
    published_at: string | null;
    first_seen_at: string;
  }>;
  findingsThisWeek: Array<{
    day: string;
    total: number;
    critical: number;
    high: number;
    warning: number;
  }>;
  recentFixes: Array<{
    id: string;
    status: string;
    created_at: string;
    finding_title: string;
    repo_name: string;
    pr_url: string | null;
    pr_state: string | null;
  }>;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Overview request failed (${res.status})`);
      }
      const json = await res.json() as OverviewData;
      setData(json);
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error("Failed to load overview data:", err);
      setError("The dashboard could not refresh. Try again in a moment.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const interval = window.setInterval(loadOverview, 30_000);
    return () => window.clearInterval(interval);
  }, [loadOverview]);

  const stats = data?.stats ?? {
    connectedRepositories: 0,
    scansCompleted: 0,
    openFindings: 0,
    criticalFindings: 0,
    draftPrsCount: 0,
    providerRulesPending: 0,
    providerRulesApproved: 0,
    rescansPending: 0,
    rescansProcessing: 0,
    rescansFailed: 0,
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="py-24 text-center text-xs text-[#686868] font-sans">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
        <span>Loading workspace overview...</span>
      </div>

    );
  }

  return (
    <div className="space-y-8 font-sans">
      <ConnectRepoModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={loadOverview}
      />

      {error && (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadOverview} disabled={refreshing} className="border-rose-300 bg-white text-rose-900">
            {refreshing ? "Retrying..." : "Retry"}
          </Button>
        </div>
      )}

      {/* WELCOME BANNER (EDITORIAL) */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#686868]">
              PRODUCTION WORKSPACE
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-[#111111]">
              Welcome back.
            </h1>
            <p className="text-xs sm:text-sm text-[#686868] mt-1">
              {stats.connectedRepositories} {stats.connectedRepositories === 1 ? 'repository' : 'repositories'} monitored · {stats.scansCompleted} {stats.scansCompleted === 1 ? 'scan' : 'scans'} completed · {stats.openFindings} {stats.openFindings === 1 ? 'finding' : 'findings'} open
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={loadOverview}
              disabled={refreshing}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="font-medium text-xs"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <span role="status" aria-live="polite" aria-atomic="true" className="hidden text-[10px] text-[#686868] sm:inline">
              {lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not refreshed"}
            </span>
            {data?.criticalFinding ? (
              <Link href={`/dashboard/findings/${data.criticalFinding.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#111111] px-4.5 py-2.5 text-sm font-sans font-medium text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/20 active:scale-[0.99]">
                <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 text-amber-300" />
                <span>Review Critical Finding</span>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsConnectOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="font-medium"
              >
                Connect Repository
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#E8E8E5] bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Provider intelligence</p>
            <h2 className="mt-2 text-base font-semibold text-[#111111]">Recent provider changes</h2>
            <p className="mt-1 text-xs text-[#686868]">Official source updates are evidence only until you approve a rule.</p>
          </div>
          <Link href="/dashboard/rules/pending" className="text-xs font-medium text-purple-700 hover:underline">Review candidates →</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data?.recentProviderChanges?.length ? data.recentProviderChanges.map((change) => (
            <article key={change.id} className="rounded-2xl border border-[#E8E8E5] bg-[#F6F6F4] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">{change.provider_id}</span>
                <span className="text-[10px] text-[#686868]">{new Date(change.published_at ?? change.first_seen_at).toLocaleDateString()}</span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-[#111111]">{change.title}</h3>
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[#686868]">{change.description}</p>
              <a href={change.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:underline">
                View official source <ExternalLink className="h-3 w-3" />
              </a>
            </article>
          )) : (
            <p className="py-5 text-xs text-[#686868]">No provider changelog entries have been recorded yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[#E8E8E5] bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Detection trend</p>
              <h2 className="mt-2 text-base font-semibold text-[#111111]">Findings this week</h2>
              <p className="mt-1 text-xs text-[#686868]">New findings across active repositories during the last seven days.</p>
            </div>
            <Link href="/dashboard/findings" className="text-xs font-medium text-purple-700 hover:underline">View findings →</Link>
          </div>
          <div className="mt-5 space-y-3">
            {data?.findingsThisWeek?.length ? (() => {
              const max = Math.max(...data.findingsThisWeek.map((item) => item.total), 1);
              return data.findingsThisWeek.map((item) => (
                <div key={item.day} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 text-[#686868]">{new Date(`${item.day}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F0ED]" aria-label={`${item.total} findings on ${item.day}`}>
                    <div className="flex h-full min-w-1 overflow-hidden rounded-full" style={{ width: `${Math.max((item.total / max) * 100, 2)}%` }}>
                      <span className="bg-rose-500" style={{ width: `${(item.critical / item.total) * 100}%` }} />
                      <span className="bg-amber-500" style={{ width: `${(item.high / item.total) * 100}%` }} />
                      <span className="bg-sky-500" style={{ width: `${(item.warning / item.total) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-6 text-right font-semibold text-[#111111]">{item.total}</span>
                </div>
              ));
            })() : (
              <p className="py-5 text-xs text-[#686868]">No findings were created in the last seven days.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-[#686868]">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Critical</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />High</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Warning</span>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E8E8E5] bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Fix progress</p>
              <h2 className="mt-2 text-base font-semibold text-[#111111]">Recent fixes</h2>
              <p className="mt-1 text-xs text-[#686868]">Migration plans and draft pull requests awaiting review.</p>
            </div>
            <Link href="/dashboard/migrations" className="text-xs font-medium text-purple-700 hover:underline">View migrations →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {data?.recentFixes?.length ? data.recentFixes.map((fix) => (
              <div key={fix.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#111111]">{fix.finding_title}</p>
                  <p className="mt-1 truncate text-[10px] text-[#686868]">{fix.repo_name} · {new Date(fix.created_at).toLocaleDateString()}</p>
                </div>
                {fix.pr_url ? (
                  <a href={fix.pr_url} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-medium text-purple-700 hover:underline">Draft PR</a>
                ) : (
                  <span className="shrink-0 text-[10px] font-medium text-[#686868]">{fix.status.replaceAll("_", " ")}</span>
                )}
              </div>
            )) : (
              <p className="py-5 text-xs text-[#686868]">No migration plans or draft fixes yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-[#E8E8E5] bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-purple-700">Provider intelligence</p><h2 className="mt-2 text-base font-semibold text-[#111111]">Review queue</h2><p className="mt-1 text-xs text-[#686868]">Official source changes wait for your approval before they affect scans.</p></div>
            <ShieldCheck className="h-5 w-5 text-purple-700" />
          </div>
          <div className="mt-4 flex items-end justify-between"><div><span className="text-2xl font-semibold text-[#111111]">{stats.providerRulesPending}</span><span className="ml-2 text-xs text-[#686868]">pending rules</span></div><Link href="/dashboard/rules/pending" className="text-xs font-medium text-purple-700 hover:underline">Open review →</Link></div>
          <p className="mt-2 text-[11px] text-[#686868]">{stats.providerRulesApproved} approved rules currently available to the scanner.</p>
        </div>
        <div className="rounded-[24px] border border-[#E8E8E5] bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Rescan pipeline</p><h2 className="mt-2 text-base font-semibold text-[#111111]">Repository updates</h2><p className="mt-1 text-xs text-[#686868]">Approval and nightly freshness jobs are tracked durably.</p></div>
            <ScanLine className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs"><span><strong className="text-[#111111]">{stats.rescansPending}</strong> pending</span><span><strong className="text-[#111111]">{stats.rescansProcessing}</strong> processing</span><span className={stats.rescansFailed ? "text-rose-700" : "text-emerald-700"}><strong>{stats.rescansFailed}</strong> failed</span></div>
          <p className="mt-2 text-[11px] text-[#686868]">A failed job remains visible for retry and investigation; it is never silently discarded.</p>
        </div>
      </div>

      {/* ONBOARDING CHECKLIST BANNER */}
      {(stats.connectedRepositories === 0 || !data?.workspace?.hasGitHubInstallation || stats.scansCompleted === 0) && (
        <div className="rounded-[28px] bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 text-white p-8 space-y-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-800/60 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-800/50 border border-purple-700/50 text-[11px] font-semibold tracking-wide uppercase text-purple-200">
                Getting Started with MY OWL
              </div>
              <h2 className="text-xl font-semibold mt-2 text-white">
                4 Steps to Review Breaking API Changes
              </h2>
            </div>
            <Button
              size="sm"
              onClick={() => setIsConnectOpen(true)}
              className="bg-white text-purple-950 hover:bg-purple-100 font-semibold gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Connect GitHub Repository</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Step 1 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              data?.workspace?.hasGitHubInstallation
                ? "bg-purple-900/40 border-emerald-500/40"
                : "bg-purple-900/80 border-purple-700"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-800 flex items-center justify-center font-semibold text-purple-200 text-[11px]">1</span>
                {data?.workspace?.hasGitHubInstallation ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-purple-300 font-medium">Pending</span>
                )}
              </div>
              <h3 className="font-semibold text-white text-xs mb-1">Connect GitHub App</h3>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Authorize the MY OWL GitHub App with restricted repository access for read-only scans.
              </p>
            </div>

            {/* Step 2 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              stats.connectedRepositories > 0
                ? "bg-purple-900/40 border-emerald-500/40"
                : "bg-purple-900/80 border-purple-700"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-800 flex items-center justify-center font-semibold text-purple-200 text-[11px]">2</span>
                {stats.connectedRepositories > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-purple-300 font-medium">Pending</span>
                )}
              </div>
              <h3 className="font-semibold text-white text-xs mb-1">Choose Repository</h3>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Select target repositories to monitor for breaking vendor API changes.
              </p>
            </div>

            {/* Step 3 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              stats.scansCompleted > 0
                ? "bg-purple-900/40 border-emerald-500/40"
                : "bg-purple-900/80 border-purple-700"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-800 flex items-center justify-center font-semibold text-purple-200 text-[11px]">3</span>
                {stats.scansCompleted > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-purple-300 font-medium">Pending</span>
                )}
              </div>
              <h3 className="font-semibold text-white text-xs mb-1">Run Initial AST Scan</h3>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Scan target repo commits using deterministic AST pattern matchers.
              </p>
            </div>

            {/* Step 4 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              stats.draftPrsCount > 0 || stats.openFindings > 0
                ? "bg-purple-900/40 border-emerald-500/40"
                : "bg-purple-900/80 border-purple-700"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-800 flex items-center justify-center font-semibold text-purple-200 text-[11px]">4</span>
                {stats.draftPrsCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-purple-300 font-medium">Pending</span>
                )}
              </div>
              <h3 className="font-semibold text-white text-xs mb-1">Review findings</h3>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Inspect findings, verify the official evidence, and decide the next engineering action.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EDITORIAL SPLIT: LEFT 65% / RIGHT 35% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT 65%: REPOSITORIES REQUIRING ATTENTION & MONITORED TABLE */}
        <div className="lg:col-span-8 space-y-6">

          {/* CRITICAL FINDING ROW */}
          {data?.criticalFinding ? (
            <div className="rounded-[24px] bg-[#FEF8EC] border border-[#FDE68A] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-950">Action Required</span>
                  <span className="text-xs text-amber-700">·</span>
                  <span className="text-xs text-amber-800">{data.criticalFinding.repo_name}</span>
                </div>
                <StatusPill status="affected" label={data.criticalFinding.severity.toUpperCase()} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-[#111111]">
                  {data.criticalFinding.title}
                </h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  {data.criticalFinding.description} In <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#E8E8E5]">{data.criticalFinding.file_path}</code>.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deterministic AST Detection</span>
                </div>
                <Link href={`/dashboard/findings/${data.criticalFinding.id}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E8E8E5] bg-white px-3.5 py-2 text-xs font-sans font-medium text-[#111111] shadow-xs transition-all duration-200 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-black/20">
                  <span>Inspect Finding &amp; Plan</span>
                  <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#EEF7F2] border border-[#D1EBE0] p-6 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-950 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All monitored repositories are up to date</span>
              </div>
              <p className="text-xs text-emerald-800">
                No breaking third-party API changes detected across active bindings. Run a scan to analyze recent commits.
              </p>
            </div>
          )}

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
              {data?.repositories && data.repositories.length > 0 ? (
                data.repositories.map((repo) => (
                  <div key={repo.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/repositories/${repo.id}`} className="text-sm font-semibold text-[#111111] hover:underline font-mono">
                          {repo.name}
                        </Link>
                        <StatusPill
                          status={repo.findings_count > 0 ? 'affected' : 'healthy'}
                          label={repo.findings_count > 0 ? `${repo.findings_count} findings` : 'Healthy'}
                        />
                      </div>
                      <div className="text-xs text-[#686868]">
                        <span className="font-mono text-[11px] text-[#686868]">{repo.full_name}</span> · Branch: <span className="font-mono text-[11px] text-[#111111]">{repo.default_branch}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs hidden sm:block">
                        <div className="text-[#111111] font-medium">{repo.findings_count} findings</div>
                        <div className="text-[#686868] text-[11px]">{repo.last_scan_at ? new Date(repo.last_scan_at).toLocaleDateString() : 'Not scanned'}</div>
                      </div>
                      <Link href={`/dashboard/repositories/${repo.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E8E8E5] bg-white px-3.5 py-2 text-xs font-sans font-medium text-[#111111] shadow-xs transition-all duration-200 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-black/20">
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[#686868] text-xs space-y-3">
                  <p>No repositories connected yet.</p>
                  <Button size="sm" variant="outline" onClick={() => setIsConnectOpen(true)}>
                    Connect Your First Repository
                  </Button>
                </div>
              )}
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
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.map((act) => (
                  <div key={act.id} className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                    <div className="flex items-center justify-between text-[#111111] font-medium">
                      <span className="truncate">{act.title}</span>
                      <span className="text-[10px] text-[#686868] shrink-0 font-mono">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#686868] leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-[#686868]">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM: REPOSITORY COMPATIBILITY MAP */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#111111]">Repository Compatibility Map</h3>
            <p className="text-xs text-[#686868]">Deterministic mapping of vendor API breaking change definitions against repository AST symbols.</p>
          </div>
        </div>

        <CompatibilityMap onConnect={() => setIsConnectOpen(true)} />
      </div>

    </div>
  );
}
