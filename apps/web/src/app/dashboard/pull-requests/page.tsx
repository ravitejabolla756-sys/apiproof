import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  GitPullRequest,
  ExternalLink,
  GitBranch,
  CheckCircle2,
} from "lucide-react";

export default function PullRequestsReviewQueuePage() {
  const pr = demoData.pullRequests[0] || {
    id: "pr-1",
    number: 1,
    title: "APIProof: migrate stripe-subscription-coupon-removed",
    repositoryId: "apiproof-github-fixture",
    branch: "apiproof/stripe-subscription-coupon-removed-9cc601a8",
    state: "draft",
    url: "https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1",
    createdAt: "2026-09-09 19:35 UTC",
  };

  return (
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Pull requests
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review queue for generated draft pull requests.
          </p>
        </div>

        <StatusPill status="pr_created" label="1 Draft PR ready for review" />
      </div>

      {/* PR Card Panel */}
      <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-blue-400 mt-0.5">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-blue-400 text-sm">
                  #{pr.number}
                </span>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {pr.title}
                </h2>
              </div>
              <div className="text-xs text-zinc-400 mt-1 flex items-center gap-3 font-mono">
                <span>Repository: <strong className="text-zinc-200">{pr.repositoryId}</strong></span>
                <span>·</span>
                <span className="flex items-center gap-1 text-zinc-300">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                  {pr.branch}
                </span>
              </div>
            </div>
          </div>

          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
              View on GitHub
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[11px] block">Verification</span>
            <span className="font-medium text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 4/4 checks passed
            </span>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[11px] block">Human review policy</span>
            <span className="font-medium text-zinc-200 block">Required before merge</span>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[11px] block">Automated merge</span>
            <span className="font-medium text-zinc-400 block">Disabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
