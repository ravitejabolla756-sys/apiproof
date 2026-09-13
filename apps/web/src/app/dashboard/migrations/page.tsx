import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

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
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            Migration Workbench
          </h1>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            AST transformation pipeline, patch digest inspector, and verification status
          </p>
        </div>

        <StatusPill status="verified" label="1 Verified Patch Active" />
      </div>

      {/* Visual Stepper Pipeline */}
      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 font-mono text-xs">
        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
          Migration Lifecycle Stepper
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
          <div className="p-2.5 rounded bg-zinc-900 border border-emerald-500/30 text-emerald-400">
            <div className="font-bold">1. Generated</div>
            <div className="text-[9px] text-zinc-500">AST Patch</div>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-emerald-500/30 text-emerald-400">
            <div className="font-bold">2. Verified</div>
            <div className="text-[9px] text-zinc-500">4/4 Gates</div>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-emerald-500/30 text-emerald-400">
            <div className="font-bold">3. Branch Created</div>
            <div className="text-[9px] text-zinc-500">apiproof/*</div>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-cyan-500/30 text-cyan-300">
            <div className="font-bold">4. Draft PR</div>
            <div className="text-[9px] text-zinc-500">PR #1 Opened</div>
          </div>
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
            <div>5. Reviewing</div>
            <div className="text-[9px] text-amber-400 font-normal">Human Mandatory</div>
          </div>
        </div>
      </div>

      {/* 3-COLUMN MIGRATION WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (3 cols): Affected Source */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-xs uppercase text-zinc-400 font-mono">
                Affected Files (1)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <div className="p-3 rounded bg-zinc-900/60 border border-emerald-500/30 text-emerald-400 font-mono font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" /> src/billing.ts
                </span>
                <span className="text-[10px] text-zinc-500">1 diff</span>
              </div>
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div>Target repo: <span className="text-zinc-200">apiproof-github-fixture</span></div>
                <div>Change rule: <span className="text-amber-400">coupon-removed</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER COLUMN (6 cols): Diff View */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-xs uppercase text-zinc-400 font-mono">
                AST Transformation Patch
              </CardTitle>
              <span className="text-[10px] text-zinc-500 font-mono">Patch Digest: dd6a85b5</span>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-lg bg-zinc-900/80 p-4 border border-zinc-800 font-mono text-xs space-y-2 leading-relaxed">
                <div className="text-zinc-500 border-b border-zinc-800 pb-1 text-[10px]">
                  @@ -14,7 +14,7 @@ export async function createSubscription(...)
                </div>
                <div className="text-zinc-400">return stripe.subscriptions.create(&#123;</div>
                <div className="text-zinc-400">  customer: customerId,</div>
                <div className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border-l-2 border-rose-500">
                  - coupon: couponId,
                </div>
                <div className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border-l-2 border-emerald-500">
                  + discounts: [&#123; coupon: couponId &#125;],
                </div>
                <div className="text-zinc-400">&#125;);</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (3 cols): Verification Inspector */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-xs uppercase text-zinc-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Verification Inspector
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-[11px]">
              <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block">Baseline SHA</span>
                <span className="text-zinc-200 font-mono text-xs">b1be45b401f41106</span>
              </div>

              <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block">Branch Name</span>
                <span className="text-emerald-400 font-mono text-[10px] break-all">
                  apiproof/stripe-subscription-coupon-removed-9cc601a8
                </span>
              </div>

              <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                <span className="text-zinc-500 block">Automated Gates</span>
                {migration.verification.checks.map((c) => (
                  <div key={c.name} className="flex justify-between text-zinc-300">
                    <span>{c.name}:</span>
                    <span className="text-emerald-400 font-bold">PASSED</span>
                  </div>
                ))}
              </div>

              {migration.pullRequest && (
                <a
                  href={migration.pullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold text-center block transition-colors"
                >
                  View Draft PR #{migration.pullRequest.number} →
                </a>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
