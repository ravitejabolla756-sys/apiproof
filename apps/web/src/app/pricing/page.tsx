"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Check, Plus, Minus } from "lucide-react";

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What does beta access cost?",
      a: "The detection-only public beta is currently free. We do not publish paid plan limits or charge for usage during the beta."
    },
    {
      q: "What does Developer Early Access include?",
      a: "During the public beta, all tiers are $0 and include read-only AST scanning plus evidence-linked compatibility findings. Migration planning and Draft Pull Request creation are not available in this beta."
    },
    {
      q: "What happens when an upstream API releases a breaking change?",
      a: "MY OWL evaluates reviewed compatibility rules against connected repositories and shows the affected usage, reason codes, and source evidence for your engineering team to review."
    },
    {
      q: "Can MY OWL change or merge my code during this beta?",
      a: "No. The current beta uses read-only GitHub access. It does not create branches, patches, or pull requests, and it cannot auto-merge code."
    },
    {
      q: "Can I connect private repositories?",
      a: "Yes. Scans require repository contents read access for AST traversal. The current beta does not request pull-request write access, and we never store your full source files on persistent disk."
    },
    {
      q: "What is included in the Enterprise plan?",
      a: "Enterprise capabilities and pricing are not part of the current beta. Contact us only to share requirements for a future release."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>DEVELOPER EARLY ACCESS: $0 TODAY</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Detection-Only Beta Access
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Read-only AST scanning and evidence-linked compatibility findings. Paid plans, quotas, and migration capabilities are not active in this beta.
          </p>
        </div>

        {/* 4 PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">

          {/* Beta access */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Beta Access</div>
                <div className="text-xs text-slate-500">For approved public beta users</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium font-mono">No paid plan is active</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">Repository access subject to beta approval</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Read-only AST scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Evidence-linked compatibility findings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Human-owned remediation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Community support</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all"
            >
              Request Beta Access
            </Link>
          </div>

          {/* Provider coverage */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border-2 border-[#004EE8]/30 relative space-y-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Provider Coverage</div>
                  <div className="text-xs text-slate-500">Reviewed compatibility evidence</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#004EE8] text-white text-[10px] font-bold tracking-wider uppercase font-mono">
                  CURRENT BETA
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold font-mono uppercase tracking-wide">Reviewed coverage</div>
                <div className="text-[11px] text-slate-500">Provider rules are reviewed before inclusion.</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">15 reviewed providers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>20 reviewed compatibility rules</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>AFFECTED, NOT_AFFECTED, and NEEDS_REVIEW evidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Exact source locations where available</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Read-only repository analysis</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all shadow-sm"
            >
              Explore the Beta
            </Link>
          </div>

          {/* Team review */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Team Review</div>
                <div className="text-xs text-slate-500">Bring findings to your existing workflow</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold font-mono uppercase tracking-wide">Detection only</div>
                <div className="text-[11px] text-slate-500">No active paid quotas.</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">Workspace-scoped findings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Compatibility Proof review</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Read-only GitHub access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Human-owned remediation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Pricing and quotas announced separately</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all"
            >
              Join the Beta
            </Link>
          </div>

          {/* Future enterprise interest */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Future Enterprise</div>
                <div className="text-xs text-slate-500">Requirements intake only</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-2xl font-normal text-[#000E29]">Not priced yet</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Share future requirements</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">No enterprise entitlement is active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Detection-only beta access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Read-only beta boundaries remain in effect</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Migration capabilities are planned, not included</span>
                </div>
              </div>
            </div>

            <Link
              href="/contact"
              className="w-full py-3 rounded-full bg-white border border-black/[0.1] hover:bg-slate-100 text-slate-900 text-xs font-semibold text-center transition-all"
            >
              Contact Us
            </Link>
          </div>

        </div>

        {/* REPOSITORIES PROTECTED EXPLAINER */}
        <div className="rounded-3xl bg-[#000E29] text-white p-8 sm:p-10 space-y-4">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
              WHAT &apos;REPOSITORIES PROTECTED&apos; MEANS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal">
              What beta access means
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              The beta evaluates approved repository snapshots against reviewed compatibility rules and presents evidence for engineering review. It does not publish paid quotas, create patches, or perform repository writes.
            </p>
          </div>
        </div>

        {/* PRICING FAQ */}
        <div className="space-y-6 pt-4">
          <h2 className="font-serif text-3xl text-[#000E29] font-normal text-center">
            Frequently Asked Pricing Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-2xl bg-[#EFF1F5] border border-black/[0.03] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(i)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left text-xs sm:text-sm font-medium text-[#000E29] hover:text-black transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="w-6 h-6 rounded-full bg-white/80 border border-black/[0.08] flex items-center justify-center text-slate-500 shrink-0 ml-4">
                      {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-black/[0.04]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
