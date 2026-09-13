import Link from "next/link";
import { notFound } from "next/navigation";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const finding = demoData.findings.find((f) => f.id === id);

  if (!finding) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-7xl font-sans text-xs">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard/findings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-4 font-medium"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to findings
        </Link>

        {/* Header Bar */}
        <div className="p-6 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>Stripe</span>
                <span>·</span>
                <span className="font-mono text-zinc-300">{finding.changeId}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">{finding.title}</h1>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill status="verified" label="Migration verified" />
              {finding.pullRequest && (
                <a
                  href={finding.pullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline" icon={<GitPullRequest className="w-3.5 h-3.5 text-blue-400" />}>
                    View PR #{finding.pullRequest.number}
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800/60 text-xs">
            <div>
              <span className="text-zinc-500 block text-[11px]">Repository</span>
              <span className="font-mono text-zinc-200 font-medium">{finding.repositoryId}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[11px]">Affected file</span>
              <span className="font-mono text-zinc-200 font-medium">{finding.file}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[11px]">Confidence</span>
              <span className="text-zinc-200 font-medium">1.0 (Exact AST Symbol Match)</span>
            </div>
          </div>
        </div>
      </div>

      {/* IMPACT EVIDENCE TRAVERSAL */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Impact evidence trace</h2>

        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>subscriptions.create(...)</span>
          </div>
          <div className="pl-6 text-zinc-400 border-l border-zinc-800 ml-2 space-y-1">
            <div>↓ coupon property detected at <span className="text-zinc-200">{finding.file}:4</span></div>
            <div className="text-emerald-400">✓ Refactored to discounts property parameter</div>
          </div>
        </div>
      </div>

      {/* CODE DIFF WORKBENCH */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Code transformation diff</h2>
          <span className="text-[11px] font-mono text-zinc-500">Digest: dd6a85b5</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* BEFORE */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-rose-950/60 space-y-2">
            <div className="text-rose-400 font-sans font-semibold text-xs border-b border-rose-950/80 pb-2">
              Before (Deprecated usage)
            </div>
            <pre className="text-zinc-300 leading-relaxed overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
              <span className="bg-rose-950/80 text-rose-300 px-1.5 py-0.5 rounded font-semibold">
{`  coupon: couponId`}
              </span>
{`
});`}
            </pre>
          </div>

          {/* AFTER */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-emerald-950/60 space-y-2">
            <div className="text-emerald-400 font-sans font-semibold text-xs border-b border-emerald-950/80 pb-2">
              After (Verified migration)
            </div>
            <pre className="text-zinc-300 leading-relaxed overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
              <span className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
{`  discounts: [{ coupon: couponId }]`}
              </span>
{`
});`}
            </pre>
          </div>
        </div>
      </div>

      {/* AUTOMATED VERIFICATION CHECKLIST */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Verification checklist</h2>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-2 text-xs">
          {finding.verification.checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-zinc-200">{check.name}</span>
                <span className="text-zinc-500 font-mono text-[11px]">({check.detail})</span>
              </div>
              <span className="text-emerald-400 font-mono font-medium text-xs">Passed</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
