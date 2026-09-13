"use client";

import Link from "next/link";
import { DEMO_FINDING_STRIPE, DEMO_VERIFICATION_CHECKS, DEMO_PULL_REQUEST } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  ArrowUpRight,
} from "lucide-react";

export default function FixtureRepoDetailPage() {
  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">

      {/* BACK BUTTON */}
      <div>
        <Link href="/dashboard/repositories" className="inline-flex items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Repositories
        </Link>
      </div>

      {/* HERO BAND */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#111111]">
                apiproof-github-fixture
              </h1>
              <StatusPill status="pr_created" label="Draft PR #1 Created" />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#686868] font-mono">
              <span>ravitejabolla756-sys/apiproof-github-fixture</span>
              <span>·</span>
              <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5 text-purple-700" /> main</span>
              <span>·</span>
              <span>Stripe SDK v16.0.0</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={DEMO_PULL_REQUEST.url}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="primary" className="gap-1.5 text-xs font-medium">
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>View Draft PR #1</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* FINDING CARD */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span className="font-semibold text-sm text-[#111111]">Stripe Subscription Coupon Parameter Removal</span>
          </div>
          <StatusPill status="verified" label="Migration Verified" />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-[#686868] leading-relaxed">
            {DEMO_FINDING_STRIPE.description}
          </div>
          <div className="text-xs text-[#111111]">
            Affected file: <code className="font-mono bg-[#F6F6F4] px-2 py-0.5 rounded border border-[#E8E8E5]">{DEMO_FINDING_STRIPE.affectedFile}</code>
          </div>
        </div>

        {/* VERIFICATION CHECKLIST */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#686868]">
            4-Gate Verification Results
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEMO_VERIFICATION_CHECKS.map((check) => (
              <div key={check.id} className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-emerald-950">{check.name}</div>
                  <div className="text-[11px] text-emerald-700">{check.detail}</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* PR DETAILS */}
        <div className="p-4 rounded-xl bg-[#EBF3FC] border border-[#C6E1FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-blue-950">Draft PR #1 Open on GitHub</div>
            <div className="text-blue-800 font-mono text-[11px]">Branch: {DEMO_PULL_REQUEST.headBranch}</div>
          </div>
          <Link href="/dashboard/findings/fnd-1">
            <Button size="sm" variant="primary" className="gap-1 text-xs">
              <span>Inspect Workbench</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}
