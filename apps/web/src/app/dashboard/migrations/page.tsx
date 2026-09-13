import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { GitPullRequest, ExternalLink, FileCode } from "lucide-react";

export default function MigrationWorkbenchPage() {
  const migration = demoData.migrations[0] || {
    id: "mig-1",
    title: "Stripe subscription coupon parameter removal",
    providerId: "Stripe",
    repositoryId: "apiproof-github-fixture",
    status: "Draft PR Created",
    verification: {
      checks: [
        { id: "v1", name: "Patch Application", status: "passed", detail: "Applied AST diff" },
        { id: "v2", name: "TypeScript Build", status: "passed", detail: "tsc --noEmit clean" },
        { id: "v3", name: "Unit Tests", status: "passed", detail: "All tests green" },
        { id: "v4", name: "API Contract", status: "passed", detail: "Verified payload" },
      ],
    },
    pullRequest: {
      number: 1,
      url: "https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1",
    },
  };

  return (
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Migrations
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Verified AST code transformations prepared for pull request delivery.
          </p>
        </div>

        <StatusPill status="verified" label="Migration verified" />
      </div>

      {/* Code Review Layout: Main Diff (75%) / Right Details (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / CENTER: Large Code Diff Area (9 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 font-mono text-xs">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-zinc-200">src/billing.ts</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-400 text-[11px]">stripe-subscription-coupon-removed</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Digest: dd6a85b5</span>
            </div>

            {/* Code Diff Display */}
            <div className="rounded-md bg-zinc-950 p-4 border border-zinc-800/80 font-mono text-xs leading-relaxed space-y-1 overflow-x-auto">
              <div className="text-zinc-500 text-[11px] pb-1 border-b border-zinc-800/60 mb-2">
                @@ -14,7 +14,7 @@ export async function createSubscription(...)
              </div>
              <div className="text-zinc-400">  return stripe.subscriptions.create(&#123;</div>
              <div className="text-zinc-400">    customer: customerId,</div>
              <div className="text-zinc-400">    items: [&#123; price: priceId &#125;],</div>
              <div className="bg-rose-950/60 text-rose-300 px-2 py-0.5 rounded border-l-2 border-rose-500">
                -   coupon: couponId,
              </div>
              <div className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border-l-2 border-emerald-500">
                +   discounts: [&#123; coupon: couponId &#125;],
              </div>
              <div className="text-zinc-400">  &#125;);</div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Migration Details (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-zinc-100">Migration details</h2>

            <div className="space-y-3 font-sans">
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Change rule</span>
                <span className="font-mono text-zinc-200 font-medium text-xs">
                  stripe-subscription-coupon-removed
                </span>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Target repository</span>
                <span className="font-mono text-zinc-200 font-medium text-xs">
                  apiproof-github-fixture
                </span>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Baseline SHA</span>
                <span className="font-mono text-zinc-300 text-xs">b1be45b401f41106</span>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Changed files</span>
                <span className="font-mono text-zinc-200 text-xs">1 file (src/billing.ts)</span>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Verification status</span>
                <span className="text-emerald-400 font-medium text-xs">Passed (4/4 automated checks)</span>
              </div>

              {migration.pullRequest && (
                <a
                  href={migration.pullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block pt-1"
                >
                  <Button size="sm" className="w-full justify-center gap-1.5" icon={<GitPullRequest className="w-3.5 h-3.5" />}>
                    View Draft PR #{migration.pullRequest.number}
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
