import Link from 'next/link';
import {
  FolderGit2,
  Boxes,
  AlertTriangle,
  FileCheck2,
  GitPullRequest,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  PhoneCall,
  CreditCard,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthViz } from '@/components/dashboard/health-viz';
import { DEMO_STATS, DEMO_REPOSITORIES, DEMO_ACTIVITIES } from '@/lib/demo-data';

export const metadata = {
  title: 'Dashboard Overview — APIProof',
  description: 'Executive developer dashboard for API change intelligence',
};

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            Overview
            <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              All Systems Operational
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            APIProof Change Intelligence active across 2 connected repositories.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-[#12141c] border border-[#1f2333] px-3 py-1.5 rounded-lg">
          <Clock className="h-3.5 w-3.5 text-sky-400" />
          <span>Last automated scan: <strong className="text-zinc-200">Just now</strong></span>
        </div>
      </div>

      {/* 6 Key Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Repositories</span>
            <FolderGit2 className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">{DEMO_STATS.connectedRepositories}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 inline" /> 100% Synced
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Integrations</span>
            <Boxes className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">{DEMO_STATS.detectedIntegrationsCount}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Indexed SDKs</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Reviewed Rules</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">{DEMO_STATS.reviewedChangesChecked}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Checked</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Open Findings</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{DEMO_STATS.openFindingsCount}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">Stripe Deprecation</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Migrations</span>
            <FileCheck2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{DEMO_STATS.verifiedMigrationsCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">4/4 Gates Passed</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Draft PRs</span>
            <GitPullRequest className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">{DEMO_STATS.draftPrsCount}</div>
          <div className="text-[11px] text-sky-400/80 mt-1">Review Mandatory</div>
        </Card>
      </div>

      {/* Compatibility Health Visualization */}
      <HealthViz />

      {/* Two Column Layout: Repositories & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Repositories */}
        <div className="lg:col-span-2 space-y-4">
          <CardHeader className="mb-0">
            <CardTitle>
              <FolderGit2 className="h-4 w-4 text-sky-400" />
              Connected Repositories
            </CardTitle>
            <Link
              href="/dashboard/repositories"
              className="text-xs text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
            >
              View all ({DEMO_REPOSITORIES.length}) <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>

          <div className="space-y-3">
            {/* Repo 1: Bavio */}
            <Card className="p-4 hover:border-zinc-700 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Link
                      href="/dashboard/repositories/bavio-ai-v1"
                      className="font-mono text-sm font-semibold text-zinc-100 hover:text-sky-400 transition-colors"
                    >
                      Bavio-Ai-v1
                    </Link>
                    <Badge variant="healthy">Healthy</Badge>
                    <span className="text-[11px] font-mono text-zinc-500">main</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Twilio Telephony & Media Streams indexed across 390 repository files.
                  </p>
                </div>
                <Link
                  href="/dashboard/repositories/bavio-ai-v1"
                  className="text-xs text-zinc-400 hover:text-zinc-200 p-1.5 rounded bg-[#171a26] border border-[#222738]"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1f2333] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4 text-zinc-400">
                  <span className="flex items-center gap-1">
                    <PhoneCall className="h-3.5 w-3.5 text-amber-400" /> Twilio (27 usages)
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="font-mono text-zinc-500">twilio@^5.12.2</span>
                </div>
                <span className="text-emerald-400 font-mono text-[11px]">0 Matching Reviewed Issues</span>
              </div>
            </Card>

            {/* Repo 2: apiproof-github-fixture */}
            <Card className="p-4 border-sky-500/30 bg-[#121624] hover:border-sky-500/50 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Link
                      href="/dashboard/repositories/apiproof-github-fixture"
                      className="font-mono text-sm font-semibold text-zinc-100 hover:text-sky-400 transition-colors"
                    >
                      apiproof-github-fixture
                    </Link>
                    <Badge variant="info">Draft PR #1</Badge>
                    <span className="text-[11px] font-mono text-zinc-500">main</span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1.5">
                    Stripe coupon property deprecation detected in <code className="text-sky-300 bg-sky-950/60 px-1 py-0.5 rounded">src/billing.ts</code>.
                  </p>
                </div>
                <a
                  href="https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 p-1.5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center gap-1 font-mono"
                >
                  PR #1 <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1f2333] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4 text-zinc-400">
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-sky-400" /> Stripe (1 affected)
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="font-mono text-zinc-500">stripe@16.0.0</span>
                </div>
                <span className="text-emerald-400 font-mono text-[11px]">4/4 Verification Gates Passed</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-4">
          <CardHeader className="mb-0">
            <CardTitle>
              <Clock className="h-4 w-4 text-amber-400" />
              Recent Activity
            </CardTitle>
            <Link href="/dashboard/activity" className="text-xs text-zinc-400 hover:text-zinc-200 font-mono">
              All
            </Link>
          </CardHeader>

          <Card className="p-4 space-y-4">
            {DEMO_ACTIVITIES.map((activity) => (
              <div key={activity.id} className="flex gap-3 text-xs border-b border-[#1b1f2e] pb-3 last:border-0 last:pb-0">
                <div className="mt-1 shrink-0">
                  <div className="h-2 w-2 rounded-full bg-sky-500" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-200 truncate">{activity.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">{activity.badge}</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">{activity.description}</p>
                  <span className="text-[10px] font-mono text-zinc-500 block pt-0.5">{activity.timestamp}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
