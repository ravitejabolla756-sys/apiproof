"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { CompatibilityMap } from "@/components/dashboard/compatibility-map";
import { ArrowUpRight, AlertTriangle, GitBranch, ArrowRight, CheckCircle2, RefreshCw, Plus, Loader2 } from "lucide-react";
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
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  async function loadOverview() {
    try {
      const res = await fetch("/api/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  const stats = data?.stats ?? {
    connectedRepositories: 0,
    scansCompleted: 0,
    openFindings: 0,
    criticalFindings: 0,
    draftPrsCount: 0,
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-[#686868] font-sans">
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
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="font-medium text-xs"
            >
              Refresh
            </Button>
            {data?.criticalFinding ? (
              <Link href={`/dashboard/findings/${data.criticalFinding.id}`}>
                <Button size="sm" className="gap-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                  <span>Review Critical Finding</span>
                </Button>
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

      {/* ONBOARDING CHECKLIST BANNER */}
      {(stats.connectedRepositories === 0 || !data?.workspace?.hasGitHubInstallation || stats.scansCompleted === 0) && (
        <div className="rounded-[28px] bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 text-white p-8 space-y-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-800/60 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-800/50 border border-purple-700/50 text-[11px] font-semibold tracking-wide uppercase text-purple-200">
                Getting Started with MY OWL
              </div>
              <h2 className="text-xl font-semibold mt-2 text-white">
                4 Steps to Automate Breaking API Migration PRs
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
              <h4 className="font-semibold text-white text-xs mb-1">Connect GitHub App</h4>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Authorize the MY OWL GitHub App with read-only repository permissions.
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
              <h4 className="font-semibold text-white text-xs mb-1">Choose Repository</h4>
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
              <h4 className="font-semibold text-white text-xs mb-1">Run Initial AST Scan</h4>
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
              <h4 className="font-semibold text-white text-xs mb-1">Review & Draft PR</h4>
              <p className="text-purple-200 text-[11px] leading-relaxed">
                Inspect findings, verify patch diffs, and create safe draft PRs.
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
                <Link href={`/dashboard/findings/${data.criticalFinding.id}`}>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs bg-white">
                    <span>Inspect Finding & Plan</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
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
                      <Link href={`/dashboard/repositories/${repo.id}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          Inspect
                        </Button>
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
