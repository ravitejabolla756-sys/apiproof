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
      q: "Why is pricing based on 'Repositories Protected' rather than scan credits?",
      a: "API changes don't operate on artificial monthly tokens. You need continuous, deterministic protection for your repositories whenever an upstream dependency releases a breaking change or whenever your team pushes code. You only pay for the repositories you actively protect; scans within those repositories are unlimited."
    },
    {
      q: "What does Developer Early Access include?",
      a: "During our public launch preview, all tiers are $0 with full access to AST scanning, deterministic migration planning, and verified draft PR generation. We want engineering teams to validate our zero-noise detection in their production workflows."
    },
    {
      q: "What happens when an upstream API releases a breaking change?",
      a: "MY OWL evaluates the new rule against all connected repositories. If your repository uses the package, our AST parser traverses your code to check for reachable call sites. If an affected call site is confirmed, MY OWL constructs a migration plan, verifies it through our 4-gate harness, and opens a GitHub Draft PR for your review."
    },
    {
      q: "Does MY OWL have permissions to auto-merge code?",
      a: "Never. MY OWL has zero auto-merge capability and zero auto-merge permissions. It opens a GitHub Draft Pull Request marked draft: true on an isolated branch (apiproof/*). A human engineer on your team must review, test, and merge the change."
    },
    {
      q: "Can I connect private repositories?",
      a: "Yes. Our GitHub App permissions are strictly scoped to repository contents (read-only for AST traversal) and pull requests (write access only to isolated branches). We never store your full source files on persistent disk."
    },
    {
      q: "What is included in the Enterprise plan?",
      a: "Enterprise includes custom breaking change rules for internal microservices, self-hosted runner support for private VPCs, custom SLA, dedicated migration architect support, and organization-wide governance."
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
            Protected Repositories, Predictable Pricing
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Scaled by the repositories you protect. Unlimited AST scans, no artificial credit counters, and strict read-only safety guarantees.
          </p>
        </div>

        {/* 4 PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">

          {/* Tier 1: Free */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Free</div>
                <div className="text-xs text-slate-500">For individuals &amp; side projects</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium font-mono">Free during Early Access</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">3 repositories protected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Unlimited AST scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>2 verified draft PRs / mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>4-gate verification harness</span>
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
              Get Started Free
            </Link>
          </div>

          {/* Tier 2: Pro (Popular) */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border-2 border-[#004EE8]/30 relative space-y-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Pro</div>
                  <div className="text-xs text-slate-500">For fast-moving developers</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#004EE8] text-white text-[10px] font-bold tracking-wider uppercase font-mono">
                  Popular
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$29</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Billed monthly</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">15 repositories protected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Unlimited AST scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Continuous webhook scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>20 verified draft PRs / mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Priority email support</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all shadow-sm"
            >
              Start Pro Plan
            </Link>
          </div>

          {/* Tier 3: Team */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Team</div>
                <div className="text-xs text-slate-500">For engineering organizations</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$99</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Billed monthly</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">50 repositories protected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Unlimited AST scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>100 verified draft PRs / mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Multi-seat collaboration</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Slack / Discord notifications</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all"
            >
              Start Team Plan
            </Link>
          </div>

          {/* Tier 4: Enterprise */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Enterprise</div>
                <div className="text-xs text-slate-500">For security-sensitive scale</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-3xl font-normal text-[#000E29]">Custom</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Tailored agreement</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">Unlimited repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Custom AST migration rules</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Self-hosted test runner runner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Dedicated migration architect</span>
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
              Continuous Intelligence on Every Repository
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              When a repository is protected by MY OWL, we maintain an AST symbol map of its dependencies and listen for upstream API breaking change announcements. Scans, re-scans, and AST analyses within that repository are completely unmetered.
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
