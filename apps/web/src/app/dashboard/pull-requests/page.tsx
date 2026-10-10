"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { getPullRequestStateLabel } from "@/lib/compatibility-map-labels";
import { GitPullRequest, ExternalLink, ShieldCheck, Loader2, RefreshCw } from "lucide-react";

interface PullRequestItem {
  id: string;
  number: number;
  title: string;
  branch_name: string;
  base_branch: string;
  url: string;
  state: string;
  created_at: string;
  patch_digest: string;
  repo_name: string;
  repo_full_name: string;
  symbol: string;
  file_path: string;
  change_id: string;
}

export default function PullRequestsPage() {
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPRs() {
    try {
      const res = await fetch("/api/pull-requests");
      if (res.ok) {
        const json = await res.json();
        setPullRequests(json.pullRequests || []);
      }
    } catch (err) {
      console.error("Failed to load pull requests:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPRs();
  }, []);

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-blue-600" />
            Legacy Pull Request History
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Pull Request creation is unavailable in the detection-only beta. Any records shown here are historical only.
          </p>
        </div>

        <Button
          onClick={loadPRs}
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
          <span>Loading pull requests...</span>
        </div>
      ) : pullRequests.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-2">
          <GitPullRequest className="w-8 h-8 text-blue-600 mx-auto" />
          <p className="font-semibold text-base text-[#111111]">Pull Request creation is unavailable</p>
          <p className="text-xs text-[#686868]">
            MY OWL currently provides compatibility evidence for your team to remediate in its own workflow.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pullRequests.map((pr) => (
            <div key={pr.id} className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E8E8E5]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base text-[#111111]">
                      Pull Request #{pr.number}: {pr.title}
                    </span>
                  </div>
                  <div className="text-xs text-[#686868] font-mono">
                    Repository: {pr.repo_name} · Branch: <code className="text-[#111111]">{pr.branch_name}</code> → <code className="text-[#111111]">{pr.base_branch}</code>
                  </div>
                </div>

                <StatusPill
                  status={pr.state === 'draft' || pr.state === 'open' ? 'pr_created' : pr.state === 'merged' ? 'healthy' : pr.state === 'closed' ? 'warning' : 'neutral'}
                  label={getPullRequestStateLabel(pr.state)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Change Rule</div>
                  <div className="font-mono text-[#111111] font-semibold">{pr.change_id}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Patch Digest SHA</div>
                  <div className="font-mono text-[#111111] font-semibold truncate">{pr.patch_digest.slice(0, 16)}...</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Merge Policy</div>
                  <div className="text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Human Review Required
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-[#686868]">Created: {new Date(pr.created_at).toLocaleString()}</span>
                <a href={pr.url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="primary" className="gap-1.5 text-xs font-medium">
                    <span>Inspect on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
