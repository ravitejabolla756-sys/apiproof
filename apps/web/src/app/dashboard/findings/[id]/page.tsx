import Link from "next/link";
import { notFound } from "next/navigation";
import { demoData } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  AlertTriangle,
  FileCode,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
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

  const repo = demoData.repositories.find((r) => r.id === finding.repositoryId);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/dashboard/findings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Findings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {finding.providerId}
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100 font-mono">
                {finding.id}
              </h1>
              <Badge variant="destructive" className="uppercase text-[10px]">
                {finding.severity}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">{finding.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success" className="h-8 px-3 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Migration Verified
            </Badge>
            {finding.pullRequest && (
              <a
                href={finding.pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
                View PR #{finding.pullRequest.number}
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Primary Grid Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Change Intelligence Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed font-sans">
              {finding.description}
            </p>
            <div className="bg-zinc-950 p-4 rounded-md border border-zinc-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Reviewed Intelligence ID:</span>
                <span className="font-mono text-zinc-200">{finding.changeId}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Target Deprecation / Removal:</span>
                <span className="font-mono text-amber-400">Stripe API 2024-06-20+</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Classification:</span>
                <span className="font-mono text-rose-400 font-medium">AFFECTED / BREAKING</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
              Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div>
              <span className="text-zinc-500 block mb-1">Affected Repository</span>
              <Link
                href={`/dashboard/repositories/${repo?.name || ""}`}
                className="font-mono text-emerald-400 hover:underline"
              >
                {repo?.fullName || finding.repositoryId}
              </Link>
            </div>
            <div>
              <span className="text-zinc-500 block mb-1">Affected File</span>
              <div className="font-mono text-zinc-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                {finding.file}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 block mb-1">Detected Call Pattern</span>
              <span className="font-mono text-amber-400 text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                stripe.subscriptions.create&#40;&#123; coupon &#125;&#41;
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block mb-1">Detected Date</span>
              <span className="text-zinc-300">
                {new Date(finding.detectedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affected Evidence & Code Diff */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium font-mono text-zinc-200">
              Verified Migration Diff
            </CardTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Exact source transformation verified against codebase typechecks and contracts
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]">
            {finding.file}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-md overflow-hidden border border-zinc-800 font-mono text-xs">
            <div className="bg-zinc-900/80 px-4 py-2 text-zinc-400 border-b border-zinc-800 flex justify-between">
              <span>{finding.file}</span>
              <span className="text-zinc-500">Patch digest: dd6a85b5</span>
            </div>
            <div className="bg-zinc-950 p-4 space-y-1 overflow-x-auto text-[13px] leading-relaxed">
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
        </CardContent>
      </Card>

      {/* Verification Matrix & Draft PR Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Automated Verification Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {finding.verification.checks.map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800/80"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-zinc-200">{check.name}</span>
                </div>
                <span className="text-zinc-400">{check.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-blue-400" />
              GitHub Draft PR Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {finding.pullRequest && (
              <>
                <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      PR #{finding.pullRequest.number}: {finding.pullRequest.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase text-zinc-400">
                      {finding.pullRequest.state}
                    </Badge>
                  </div>
                  <div className="text-zinc-400 text-[11px] font-mono space-y-1">
                    <div>Base branch: <span className="text-zinc-200">main</span></div>
                    <div>Head branch: <span className="text-emerald-400">{finding.pullRequest.branch}</span></div>
                    <div>Author: <span className="text-zinc-200">apiproof[bot]</span></div>
                  </div>
                </div>

                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                  <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium mb-0.5">Human Review Required</strong>
                    APIProof created a Draft PR. No automatic merge is ever executed. A developer must review and merge the PR.
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
