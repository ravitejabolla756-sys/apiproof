import Link from 'next/link';
import {
  AlertTriangle,
  FileCheck2,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  Shield,
  FileCode2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DEMO_FINDING_STRIPE,
  DEMO_VERIFICATION_CHECKS,
  DEMO_PULL_REQUEST,
} from '@/lib/demo-data';

export const metadata = {
  title: 'apiproof-github-fixture — APIProof Repository Analysis',
  description: 'Stripe subscription coupon deprecation finding and verified draft PR details',
};

export default function StripeFixtureDetailPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Back Link */}
      <Link
        href="/dashboard/repositories"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Repositories
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-zinc-100">apiproof-github-fixture</h1>
            <Badge variant="info">Draft PR #1 Created</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2 font-mono">
            <span>Owner: <strong className="text-zinc-200">ravitejabolla756-sys</strong></span>
            <span>•</span>
            <span>Repo ID: <strong className="text-zinc-200">1363070568</strong></span>
            <span>•</span>
            <span>Branch: <strong className="text-zinc-200">main</strong> (SHA <code className="text-sky-400">b1be45b4</code>)</span>
            <span>•</span>
            <span>SDK: <strong className="text-zinc-200">stripe@16.0.0</strong></span>
          </div>
        </div>

        <a
          href={DEMO_PULL_REQUEST.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/10 transition-all font-mono"
        >
          <GitPullRequest className="h-4 w-4" /> View Draft PR #1 on GitHub <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Finding Overview Banner */}
      <Card className="bg-[#191522] border-rose-500/30 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider font-semibold">
                Breaking Change Detected • Stripe v17.0.0
              </div>
              <h3 className="text-base font-bold text-zinc-100 mt-0.5">
                {DEMO_FINDING_STRIPE.title}
              </h3>
              <p className="text-xs text-zinc-300 mt-1">
                {DEMO_FINDING_STRIPE.description}
              </p>
            </div>
          </div>
          <Badge variant="affected" className="shrink-0">AFFECTED</Badge>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
          <span>Affected file: <code className="text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded">{DEMO_FINDING_STRIPE.affectedFile}</code></span>
          <span>•</span>
          <span>Symbol: <code className="text-amber-300">{DEMO_FINDING_STRIPE.symbol}</code></span>
        </div>
      </Card>

      {/* Before / After Code Diff */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <FileCode2 className="h-4 w-4 text-sky-400" />
            AST Transformation Diff: {DEMO_FINDING_STRIPE.affectedFile}
          </CardTitle>
          <span className="text-xs font-mono text-zinc-400">Verified transformation applied in PR #1</span>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#171216] border border-rose-500/30 rounded-t-lg text-xs font-mono text-rose-400">
              <span>BEFORE (Stripe v16 usage)</span>
              <span className="text-[10px] text-rose-400/80">Deprecated syntax</span>
            </div>
            <pre className="bg-[#0c090d] border border-rose-500/20 rounded-b-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              <code>{`// src/billing.ts
export async function createSubscription(customerId: string, priceId: string, couponId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
-   coupon: couponId
  });
}`}</code>
            </pre>
          </div>

          {/* After */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#101c17] border border-emerald-500/30 rounded-t-lg text-xs font-mono text-emerald-400">
              <span>AFTER (Stripe v17+ specification)</span>
              <span className="text-[10px] text-emerald-400/80">Verified replacement</span>
            </div>
            <pre className="bg-[#080d0a] border border-emerald-500/20 rounded-b-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              <code>{`// src/billing.ts
export async function createSubscription(customerId: string, priceId: string, couponId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
+   discounts: [{ coupon: couponId }]
  });
}`}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Verification Evidence */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <FileCheck2 className="h-4 w-4 text-emerald-400" />
            Verification Evidence (4/4 Passed)
          </CardTitle>
          <span className="text-xs font-mono text-emerald-400">Static AST & Type Verification</span>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMO_VERIFICATION_CHECKS.map((chk) => (
            <div
              key={chk.id}
              className="bg-[#12141c] border border-[#1f2333] rounded-lg p-3.5 flex items-start gap-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">{chk.name}</div>
                <div className="text-[11px] font-mono text-zinc-400 mt-0.5">{chk.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Draft Pull Request Information */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <GitPullRequest className="h-4 w-4 text-sky-400" />
            GitHub Pull Request Details
          </CardTitle>
        </CardHeader>

        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1f2333]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-sky-400">PR #{DEMO_PULL_REQUEST.number}</span>
                <span className="text-sm font-semibold text-zinc-100">{DEMO_PULL_REQUEST.title}</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Branch: <code className="text-sky-300">{DEMO_PULL_REQUEST.headBranch}</code> → <code className="text-zinc-300">{DEMO_PULL_REQUEST.baseBranch}</code>
              </p>
            </div>
            <a
              href={DEMO_PULL_REQUEST.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 hover:bg-sky-500/20 transition-all flex items-center gap-1.5 shrink-0"
            >
              Open on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-[#171a26] border border-[#222738] rounded-lg space-y-1">
              <span className="text-zinc-500">State</span>
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Draft Mode Active
              </div>
            </div>
            <div className="p-3 bg-[#171a26] border border-[#222738] rounded-lg space-y-1">
              <span className="text-zinc-500">Human Review</span>
              <div className="text-amber-400 font-bold">Mandatory Required</div>
            </div>
            <div className="p-3 bg-[#171a26] border border-[#222738] rounded-lg space-y-1">
              <span className="text-zinc-500">Auto Merge</span>
              <div className="text-rose-400 font-bold">Strictly Disabled</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
