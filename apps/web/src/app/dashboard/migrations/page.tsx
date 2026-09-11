import { demoData } from "@/lib/demo-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck2,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  Plus,
  ShieldCheck,
} from "lucide-react";

export default function MigrationsPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 font-mono">
            Migrations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Verified AST transformations and patch generation log
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled variant="outline" className="gap-2 text-xs cursor-not-allowed opacity-70">
            <Plus className="w-3.5 h-3.5" />
            Generate Migration
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded ml-1 font-mono">
              Backend coming next
            </span>
          </Button>
        </div>
      </div>

      {/* Migrations Table / Cards */}
      <div className="space-y-6">
        {demoData.migrations.map((m) => (
          <Card key={m.id} className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                    {m.providerId}
                  </span>
                  <CardTitle className="text-base font-medium font-mono text-zinc-100">
                    {m.title}
                  </CardTitle>
                </div>
                <p className="text-xs text-zinc-400">
                  Target repo:{" "}
                  <span className="font-mono text-zinc-200">{m.repositoryId}</span> • 1 file affected
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="success" className="h-7 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {m.status}
                </Badge>
                {m.pullRequest && (
                  <a
                    href={m.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
                    PR #{m.pullRequest.number}
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Code Diff Box */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950 font-mono text-xs overflow-hidden">
                <div className="bg-zinc-900/80 px-4 py-2 text-zinc-400 border-b border-zinc-800 flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                    src/billing.ts
                  </span>
                  <span className="text-zinc-500">Patch SHA: dd6a85b5</span>
                </div>
                <div className="p-4 space-y-1 overflow-x-auto text-[13px] leading-relaxed">
                  <div className="text-zinc-500 select-none">@@ -14,7 +14,7 @@ export async function createSubscription(...)</div>
                  <div className="text-zinc-400">   return await stripe.subscriptions.create(&#123;</div>
                  <div className="text-zinc-400">     customer: customerId,</div>
                  <div className="text-zinc-400">     items: [&#123; price: priceId &#125;],</div>
                  <div className="bg-rose-500/10 text-rose-300 px-2 py-0.5 border-l-2 border-rose-500 -mx-2">
                    -    coupon: couponId,
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 border-l-2 border-emerald-500 -mx-2">
                    +    discounts: [&#123; coupon: couponId &#125;],
                  </div>
                  <div className="text-zinc-400">   &#125;);</div>
                </div>
              </div>

              {/* Verification & Branch summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-zinc-950/60 p-3.5 rounded border border-zinc-800 space-y-2">
                  <div className="font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Verification Results
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {m.verification.checks.map((c) => (
                      <div key={c.name} className="flex justify-between text-zinc-300">
                        <span>{c.name}:</span>
                        <span className="text-emerald-400">PASSED</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-3.5 rounded border border-zinc-800 space-y-2">
                  <div className="font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
                    <GitPullRequest className="w-4 h-4 text-blue-400" />
                    Migration Metadata
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-400">
                    <div className="flex justify-between">
                      <span>Branch:</span>
                      <span className="font-mono text-emerald-400">apiproof/stripe-subscription-coupon-removed-9cc601a8</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Baseline SHA:</span>
                      <span className="font-mono text-zinc-300">b1be45b401f41106</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Safety Lock:</span>
                      <span className="font-mono text-amber-400">Draft Only / Human Review Mandatory</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
