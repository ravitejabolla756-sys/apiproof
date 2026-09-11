import Link from 'next/link';
import { AlertTriangle, ArrowRight, ExternalLink, GitPullRequest, FileCheck2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEMO_FINDING_STRIPE } from '@/lib/demo-data';

export const metadata = {
  title: 'Findings — APIProof',
  description: 'Detected API breaking changes and migration impact findings',
};

export default function FindingsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            Findings & Impact Reports
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            API and SDK breaking changes detected across analyzed repositories.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>1 Active Finding</span>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        <Card className="p-5 border-rose-500/30 hover:border-rose-500/50 transition-all space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-rose-400 uppercase tracking-wider">
                  [{DEMO_FINDING_STRIPE.provider}] {DEMO_FINDING_STRIPE.changeId}
                </span>
                <Badge variant="affected">AFFECTED</Badge>
                <Badge variant="info">Draft PR #1</Badge>
              </div>
              <h3 className="text-base font-bold text-zinc-100">
                <Link
                  href={`/dashboard/findings/${DEMO_FINDING_STRIPE.changeId}`}
                  className="hover:text-sky-400 transition-colors"
                >
                  {DEMO_FINDING_STRIPE.title}
                </Link>
              </h3>
              <p className="text-xs text-zinc-300 max-w-3xl leading-relaxed">
                {DEMO_FINDING_STRIPE.description}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={`/dashboard/findings/${DEMO_FINDING_STRIPE.changeId}`}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition-all flex items-center gap-1.5"
              >
                View Full Impact <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-[#1f2333] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-3">
              <span>Repository: <Link href="/dashboard/repositories/apiproof-github-fixture" className="text-sky-400 hover:underline">{DEMO_FINDING_STRIPE.repositoryName}</Link></span>
              <span>•</span>
              <span>File: <code className="text-rose-300">{DEMO_FINDING_STRIPE.affectedFile}</code></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-emerald-400 flex items-center gap-1">
                <FileCheck2 className="h-3.5 w-3.5" /> 4/4 Verification Passed
              </span>
              <span>•</span>
              <a
                href={DEMO_FINDING_STRIPE.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1"
              >
                <GitPullRequest className="h-3.5 w-3.5" /> PR #1 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
