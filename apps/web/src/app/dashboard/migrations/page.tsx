"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { getPullRequestStateLabel } from "@/lib/compatibility-map-labels";
import { FileCheck2, CheckCircle2, GitPullRequest, Loader2, RefreshCw, ExternalLink } from "lucide-react";

interface MigrationItem {
  id: string;
  finding_id: string;
  repository_id: string;
  plan_id: string;
  status: string;
  patch_diff: string;
  patch_digest: string;
  created_at: string;
  finding_title: string;
  symbol: string;
  file_path: string;
  line_number: number;
  change_id: string;
  repo_name: string;
  repo_full_name: string;
  pr_number?: number | null;
  pr_url?: string | null;
  branch_name?: string | null;
  lifecycle_state?: 'Migration Planned' | 'Verification Pending' | 'Verification Passed' | 'Verification Failed' | 'Draft PR Created' | 'Pull Request Open' | 'Pull Request Closed' | 'Pull Request Merged' | 'Pull Request State Unavailable';
  pr_state?: string | null;
  execution_verified?: boolean;
}

export default function MigrationsWorkbenchPage() {
  const [migrations, setMigrations] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadMigrations() {
    try {
      const res = await fetch("/api/migrations");
      if (res.ok) {
        const json = await res.json();
        setMigrations(json.migrations || []);
      }
    } catch (err) {
      console.error("Failed to load migrations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMigrations();
  }, []);

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-600" />
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
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#686868]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading review records...</span>
        </div>
      ) : migrations.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-3">
          <FileCheck2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-semibold text-base text-[#111111]">No active evidence review records yet</p>
          <p className="text-xs text-[#686868]">
            Open a finding to review its affected call site, matched rule, and official evidence.
          </p>
          <Link href="/dashboard/findings">
            <Button size="sm" variant="outline">
              View Open Findings
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {migrations.map((mig) => (
            <div
              key={mig.id}
              className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8E5]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px] uppercase">
                      {mig.change_id}
                    </span>
                    <h2 className="text-lg font-semibold text-[#111111]">
                      {mig.finding_title}
                    </h2>
                  </div>
                  <div className="text-xs text-[#686868] mt-1 font-mono">
                    Target file: {mig.file_path}:{mig.line_number} · Repo: {mig.repo_name}
                  </div>
                </div>

                <div className="flex items-center gap-3">
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
                <div className="lg:col-span-7 bg-[#F6F6F4] rounded-[24px] border border-[#E8E8E5] p-5 space-y-3 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-[#111111] flex items-center justify-between">
                    <span>{mig.execution_verified ? 'Verified Transformation Output' : 'Planned Transformation (not applied)'}</span>
                    <span className="font-mono text-[11px] text-[#686868]">{mig.file_path}</span>
                  </div>

                  <pre className="rounded-2xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800">
                    {mig.patch_diff}
                  </pre>
                </div>

                {/* VERIFICATION INSPECTOR ON RIGHT (40%) */}
                <div className="lg:col-span-5 bg-[#EEF7F2] rounded-[24px] border border-[#D1EBE0] p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verification Invariants
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
                    <div className="p-3 rounded-xl bg-white border border-[#D1EBE0] flex items-center justify-between shadow-2xs">
                      <div>
                        <div className="font-semibold text-[#111111]">Patch Scope Check</div>
                        <div className="text-[11px] text-[#686868]">{mig.execution_verified ? `Validated target: ${mig.file_path}` : `Planned target: ${mig.file_path}; checked during verification`}</div>
                      </div>
                      {mig.execution_verified ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="text-[#686868]">Pending</span>}
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-[#D1EBE0] flex items-center justify-between shadow-2xs">
                      <div>
                        <div className="font-semibold text-[#111111]">{mig.execution_verified ? 'Resulting Patch Digest' : 'Planned Digest (not verified)'}</div>
                        <div className="text-[11px] text-[#686868] font-mono truncate">{mig.patch_digest ? `${mig.patch_digest.slice(0, 18)}...` : 'Resulting patch digest pending'}</div>
                      </div>
                      {mig.execution_verified ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="text-[#686868]">Pending</span>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#D1EBE0] flex items-center justify-between">
                    {mig.pr_url ? (
                      <a href={mig.pr_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="primary" className="gap-1.5 text-xs font-medium">
                          <GitPullRequest className="w-3.5 h-3.5" />
                          <span>Inspect Pull Request #{mig.pr_number}</span>
                        </Button>
                      </a>
                    ) : (
                      <Link href={`/dashboard/findings/${mig.finding_id}`}>
                        <Button size="sm" variant="primary" className="gap-1.5 text-xs font-medium">
                          <span>Inspect Finding</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
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
