import Link from "next/link";
import { notFound } from "next/navigation";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  AlertTriangle,
  FileCode2,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
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
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard/findings"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Findings Console
        </Link>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xl text-zinc-100">{finding.id}</span>
              <StatusPill status="affected" label="BREAKING / RISK" />
              <StatusPill status="reviewed" label="CONFIDENCE: HIGH (1.0)" />
            </div>
            <p className="text-zinc-400 font-sans text-xs">{finding.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill status="verified" label="Migration Verified" />
            {finding.pullRequest && (
              <a
                href={finding.pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-bold transition-colors"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-cyan-400" />
                View PR #{finding.pullRequest.number}
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* THREE-COLUMN INTELLIGENCE FLOW */}
      <div className="space-y-3">
        <div className="text-xs uppercase text-zinc-500 font-bold tracking-wider">
          3-Step Intelligence Traversal Chain
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* STEP 1: VENDOR CHANGE */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase">
              <span>1. Vendor Change</span>
              <span>{finding.providerId} API</span>
            </div>
            <div className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              {finding.changeId}
            </div>
            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Stripe API v17+ removed top-level <code className="text-amber-300">coupon</code> parameter from subscriptions.create().
            </p>
          </div>

          {/* STEP 2: AST EVIDENCE */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-sky-400 font-bold uppercase">
              <span>2. AST Evidence</span>
              <span>Symbol Invocation</span>
            </div>
            <div className="font-bold text-zinc-200 text-xs font-mono text-amber-300">
              stripe.subscriptions.create(&#123; coupon &#125;)
            </div>
            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              AST parser identified direct bound client invocation passing deprecated field key.
            </p>
          </div>

          {/* STEP 3: REPOSITORY IMPACT */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase">
              <span>3. Repository Impact</span>
              <span>{finding.repositoryId}</span>
            </div>
            <div className="font-bold text-emerald-400 text-xs font-mono flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />
              {finding.file}
            </div>
            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              1 affected location identified in main codebase. Patch generated & verified.
            </p>
          </div>
        </div>
      </div>

      {/* CODE DIFF WORKBENCH */}
      <Card className="border-zinc-800 bg-zinc-950">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <CardTitle className="text-xs uppercase text-zinc-400 font-mono">
              Source Code Transformation Diff ({finding.file})
            </CardTitle>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Patch Digest: dd6a85b5</span>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono leading-relaxed">
            {/* BEFORE */}
            <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-2">
              <div className="text-rose-400 font-bold text-xs border-b border-rose-500/20 pb-1">
                BEFORE (Deprecated Usage)
              </div>
              <pre className="text-zinc-300 overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
                <span className="bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-bold">
{`  coupon: couponId`}
                </span>
{`
});`}
              </pre>
            </div>

            {/* AFTER */}
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="text-emerald-400 font-bold text-xs border-b border-emerald-500/20 pb-1">
                AFTER (Verified Migration)
              </div>
              <pre className="text-zinc-300 overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
                <span className="bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-bold">
{`  discounts: [{ coupon: couponId }]`}
                </span>
{`
});`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AUTOMATED VERIFICATION CHAIN */}
      <Card className="border-zinc-800 bg-zinc-950">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-xs uppercase text-zinc-400 font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Automated Verification Gate Evidence Chain
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          {finding.verification.checks.map((check) => (
            <div key={check.name} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-200">{check.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-emerald-400 font-bold text-[11px] block">PASSED</span>
              <p className="text-[10px] text-zinc-500 font-sans mt-1">{check.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
