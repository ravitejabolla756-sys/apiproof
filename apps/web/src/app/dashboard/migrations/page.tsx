"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import { getPullRequestStateLabel } from "@/lib/compatibility-map-labels";
import { toSafePullRequestUrl } from "@/lib/pull-request-contract";
import { parseMigrationWorkbenchCollection, type MigrationWorkbenchProjection } from "@/lib/migration-workbench-contract";
import { FileCheck2, CheckCircle2, GitPullRequest, Loader2, RefreshCw, ExternalLink } from "lucide-react";

type MigrationItem = MigrationWorkbenchProjection;

export default function MigrationsWorkbenchPage() {
  const [migrations, setMigrations] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMigrations() {
    setLoading(true);
    try {
      const res = await fetch("/api/migrations");
      const json = await res.json() as unknown;
      const parsed = parseMigrationWorkbenchCollection(json);
      const error = typeof json === 'object' && json !== null && 'error' in json && typeof json.error === 'string' ? json.error : null;
      if (!res.ok || !parsed) throw new Error(error || "Unable to load migration records.");
      setMigrations(parsed);
      setError(null);
    } catch (err) {
      console.error("Failed to load migrations:", err);
      setError(err instanceof Error ? err.message : "Unable to load migration records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMigrations();
  }, []);

  return (
    <div aria-busy={loading ? 'true' : undefined} className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <FileCheck2 aria-hidden="true" className="w-6 h-6 text-emerald-600" />
            Evidence Review Workbench
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Historical migration records remain visible. New plans and Draft PRs are available only for findings with reviewed deterministic templates and a ready verification worker.
          </p>
        </div>

        <Button
          onClick={loadMigrations}
          variant="outline"
          size="sm"
          disabled={loading}
          aria-busy={loading ? 'true' : undefined}
          icon={<RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
          className="font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {error && <DashboardDataError message={error} onRetry={() => void loadMigrations()} busy={loading} />}

      {error ? null : loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="py-20 text-center text-[#686868]">
          <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading review records...</span>
        </div>
      ) : migrations.length === 0 ? (
        <div role="status" aria-live="polite" aria-atomic="true" className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-3">
          <FileCheck2 aria-hidden="true" className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-semibold text-base text-[#111111]">No active evidence review records yet</p>
          <p className="text-xs text-[#686868]">
            Open a finding to review its affected call site, matched rule, and official evidence.
          </p>
          <Link href="/dashboard/findings" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E8E8E5] bg-white px-3.5 py-2 text-xs font-sans font-medium text-[#111111] shadow-xs transition-all duration-200 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-black/20">
            View Open Findings
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {migrations.map((mig) => (
            <div
              key={mig.id}
              className="min-w-0 rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px] uppercase">
                      {mig.change_id}
                    </span>
                    <h2 className="min-w-0 break-words text-lg font-semibold text-[#111111]">
                      {mig.finding_title}
                    </h2>
                  </div>
                  <div className="mt-1 break-all text-xs text-[#686868] font-mono">
                    Target file: {mig.file_path}:{mig.line_number} · Repo: {mig.repo_name}
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <StatusPill
                    status={mig.lifecycle_state === 'Verification Passed' || mig.lifecycle_state === 'Pull Request Merged' ? 'verified' : mig.lifecycle_state === 'Verification Failed' || mig.lifecycle_state === 'Pull Request Closed' ? 'warning' : mig.lifecycle_state === 'Draft PR Created' || mig.lifecycle_state === 'Pull Request Open' ? 'pr_created' : mig.lifecycle_state === 'Pull Request State Unavailable' ? 'neutral' : 'detected'}
                    label={mig.lifecycle_state || 'Verification Pending'}
                  />
                  {mig.pr_number && (
                    <StatusPill status={mig.pr_state === 'closed' ? 'warning' : mig.pr_state === 'merged' ? 'healthy' : mig.pr_state === 'draft' || mig.pr_state === 'open' ? 'pr_created' : 'neutral'} label={`${getPullRequestStateLabel(mig.pr_state)} #${mig.pr_number}`} />
                  )}
                </div>
              </div>

              {/* WORKBENCH SPLIT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* CODE DIFF ON LEFT (60%) */}
                <div className="min-w-0 lg:col-span-7 bg-[#F6F6F4] rounded-[24px] border border-[#E8E8E5] p-5 space-y-3 flex flex-col justify-between">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#111111]">
                    <span className="min-w-0 break-words">{mig.execution_verified ? 'Verified Transformation Output' : 'Planned Transformation (not applied)'}</span>
                    <span className="min-w-0 break-all font-mono text-[11px] text-[#686868]">{mig.file_path}</span>
                  </div>

                  <pre tabIndex={0} aria-label={`Migration diff for ${mig.file_path}`} className="rounded-2xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2">
                    {mig.patch_diff}
                  </pre>
                </div>

                {/* VERIFICATION INSPECTOR ON RIGHT (40%) */}
                <div className="min-w-0 lg:col-span-5 bg-[#EEF7F2] rounded-[24px] border border-[#D1EBE0] p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-600" /> Verification Invariants
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      {mig.execution_verified
                        ? 'All four verification gates executed successfully.'
                        : mig.lifecycle_state === 'Verification Failed'
                        ? 'Verification failed. Review the recorded failure before retrying.'
                        : 'Successful execution evidence is not available. Verification is required before Draft PR proposal.'}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="min-w-0 p-3 rounded-xl bg-white border border-[#D1EBE0] flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#111111]">Patch Scope Check</div>
                        <div className="break-all text-[11px] text-[#686868]">{mig.execution_verified ? `Validated target: ${mig.file_path}` : `Planned target: ${mig.file_path}; checked during verification`}</div>
                      </div>
                      {mig.execution_verified ? <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="text-[#686868]">Pending</span>}
                    </div>
                    <div className="min-w-0 p-3 rounded-xl bg-white border border-[#D1EBE0] flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#111111]">{mig.execution_verified ? 'Resulting Patch Digest' : 'Planned Digest (not verified)'}</div>
                        <div className="break-all text-[11px] text-[#686868] font-mono">{mig.patch_digest ? `${mig.patch_digest.slice(0, 18)}...` : 'Resulting patch digest pending'}</div>
                      </div>
                      {mig.execution_verified ? <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="text-[#686868]">Pending</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D1EBE0] pt-2">
                    {toSafePullRequestUrl(mig.pr_url) ? (
                      <a href={toSafePullRequestUrl(mig.pr_url) ?? undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-3.5 py-2 text-xs font-sans font-medium text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/20 active:scale-[0.99]">
                        <GitPullRequest aria-hidden="true" className="w-3.5 h-3.5" />
                        <span>Inspect Pull Request #{mig.pr_number}</span>
                      </a>
                    ) : (
                      <Link href={`/dashboard/findings/${mig.finding_id}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-3.5 py-2 text-xs font-sans font-medium text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/20 active:scale-[0.99]">
                        <span>Inspect Finding</span>
                        <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <span className="text-[11px] font-semibold text-emerald-900">Review-Only Guard</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
