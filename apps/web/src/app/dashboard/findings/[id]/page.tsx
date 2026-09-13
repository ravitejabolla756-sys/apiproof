"use client";

import Link from "next/link";
import { DEMO_FINDING_STRIPE, DEMO_VERIFICATION_CHECKS, DEMO_PULL_REQUEST } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  ShieldCheck,
  FileCode,
  ArrowRight,
} from "lucide-react";

export default function FindingDetailPage() {
  const fnd = DEMO_FINDING_STRIPE;

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">

      {/* BACK NAVIGATION */}
      <div>
        <Link href="/dashboard/findings" className="inline-flex items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Findings
        </Link>
      </div>

      {/* LIGHT CANVAS HEADER BAND */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold">
                {fnd.provider}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
                {fnd.title}
              </h1>
            </div>
            <p className="text-xs text-[#686868] max-w-2xl leading-relaxed">
              {fnd.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill status="affected" label="AFFECTED" />
            <StatusPill status="verified" label="Migration Verified" />
          </div>
        </div>

        {/* IMPACT VISUALIZATION FLOW */}
        <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686868]">
            AST Change Traversal Path
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">1. Vendor API Deprecation</div>
              <div className="font-mono text-purple-700 font-semibold">stripe-subscription-coupon-removed</div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">2. Target Symbol</div>
              <div className="font-mono text-blue-700 font-semibold">subscriptions.create</div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">3. Repository Call Site</div>
              <div className="font-mono text-[#111111] font-semibold">src/billing.ts:4</div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
              <div className="text-[10px] text-emerald-800 font-semibold">4. Refactored Parameter</div>
              <div className="font-mono text-emerald-900 font-semibold">discounts: [{`{ coupon }`}]</div>
            </div>
          </div>
        </div>
      </div>

      {/* WORKBENCH SPLIT: LEFT CODE DIFF (65%) / RIGHT EVIDENCE & VERIFICATION (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT 65%: LARGE DIFF PANEL */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                <FileCode className="w-4 h-4 text-purple-700" />
                <span>AST Code Transformation Diff — {fnd.affectedFile}</span>
              </div>
              <span className="text-[11px] font-mono text-[#686868]">apiproof-github-fixture</span>
            </div>

            {/* RESTRAINED CODE EDITOR STYLING */}
            <div className="rounded-2xl bg-zinc-950 p-5 font-mono text-xs text-zinc-100 space-y-3 overflow-x-auto">
              <div className="text-zinc-500 text-[11px] font-sans border-b border-zinc-800 pb-2 flex justify-between">
                <span>src/billing.ts (Line 1 to 12)</span>
                <span>TypeScript Refactor</span>
              </div>

              <div className="space-y-1">
                <div className="text-zinc-400">1 | import Stripe from 'stripe';</div>
                <div className="text-zinc-400">2 | const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);</div>
                <div className="text-zinc-400">3 | export async function createCustomerSubscription(customerId: string, priceId: string, couponId: string) &#123;</div>
                <div className="text-zinc-400">4 |   return stripe.subscriptions.create(&#123;</div>
                <div className="text-zinc-400">5 |     customer: customerId,</div>
                <div className="text-zinc-400">6 |     items: [&#123; price: priceId &#125;],</div>

                {/* REMOVED LINE */}
                <div className="bg-rose-950/60 text-rose-300 p-1.5 rounded border border-rose-800/40 flex items-center justify-between">
                  <span>-     coupon: couponId</span>
                  <span className="text-[10px] text-rose-400 font-sans font-medium">Deprecated parameter</span>
                </div>

                {/* ADDED MIGRATED LINE */}
                <div className="bg-emerald-950/60 text-emerald-300 p-1.5 rounded border border-emerald-800/40 flex items-center justify-between">
                  <span>+     discounts: [&#123; coupon: couponId &#125;]</span>
                  <span className="text-[10px] text-emerald-400 font-sans font-medium">Migrated for Stripe v17+</span>
                </div>

                <div className="text-zinc-400">7 |   &#125;);</div>
                <div className="text-zinc-400">8 | &#125;</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 35%: EVIDENCE, VERIFICATION & PR SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">

          {/* VERIFICATION CHECKLIST CARD */}
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Verification Invariants
            </h3>

            <div className="space-y-2">
              {DEMO_VERIFICATION_CHECKS.map((check) => (
                <div key={check.id} className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-950 text-xs">{check.name}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-[11px] text-emerald-800">{check.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DRAFT PR CARD */}
          <div className="rounded-[24px] bg-[#EBF3FC] border border-[#C6E1FA] p-6 space-y-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-blue-700" />
                <h3 className="text-base font-semibold text-blue-950">Draft PR #1 Ready</h3>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Created on isolated feature branch <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#C6E1FA]">{DEMO_PULL_REQUEST.headBranch}</code>.
              </p>
            </div>

            <div className="pt-2">
              <a href={DEMO_PULL_REQUEST.url} target="_blank" rel="noreferrer" className="w-full block">
                <Button size="md" variant="primary" className="w-full gap-2 font-medium">
                  <span>VIEW DRAFT PR ON GITHUB</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>

            <div className="text-[11px] text-blue-800 text-center font-medium">
              Human review required before merge
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
