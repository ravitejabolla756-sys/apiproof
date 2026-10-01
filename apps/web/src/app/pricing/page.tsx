"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Check, Plus, Minus, ArrowRight, ShieldCheck, GitPullRequest } from "lucide-react";

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does pricing by protected repositories work?",
      a: "You only pay for the repositories you choose to connect and actively protect. Each connected repository is continuously monitored for upstream API breaking changes across monitored vendors. You can add or disconnect repositories at any time."
    },
    {
      q: "What happens during Developer Early Access?",
      a: "During our public preview and early access phase, all tiers are $0 with unlimited scans and migration plans. We want engineering teams to experience zero-noise breaking change protection before general availability."
    },
    {
      q: "Why does MY OWL never auto-merge code?",
      a: "MY OWL is built for serious production infrastructure. We believe automated changes must always have human oversight. When an API breaking change is detected and planned, MY OWL runs 4 verification gates and opens a GitHub Draft Pull Request for your team to review, test, and merge."
    },
    {
      q: "What happens if a vendor API releases multiple breaking changes in a month?",
      a: "Each breaking change is analyzed independently. MY OWL inspects your AST to see if your repository actually uses the affected parameters or symbols, and opens a targeted draft PR with diagnostic diffs for each verified migration."
    },
    {
      q: "Can I test MY OWL on private repositories?",
      a: "Yes. Our GitHub App permissions are strictly scoped to repository contents (read-only for AST inspection) and pull requests (write access only to isolated branch apiproof/*). We never read or store your source code beyond the in-memory AST parse pass."
    },
    {
      q: "What is included in the Enterprise plan?",
      a: "Enterprise includes custom breaking change rules for internal APIs, GitHub Enterprise Server / self-hosted runner support, SOC 2 compliance documentation, SSO/SAML, dedicated Slack channel, and custom SLA."
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
            Choose a plan scaled by the repositories you protect. No usage surprises, no credit counters, and strict read-only AST safety.
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
                <div className="text-[11px] text-emerald-700 font-medium">Free during Early Access</div>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">3 repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>10 scans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>3 migration plans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>2 draft PRs / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>4-gate verification</span>
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
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border-2 border-black/[0.1] relative space-y-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Pro</div>
                  <div className="text-xs text-slate-500">For active developers &amp; apps</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#000E29] text-white text-[10px] font-bold tracking-wider uppercase">
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
                  <span className="font-semibold text-[#000E29]">15 repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>100 scans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>30 migration plans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>20 draft PRs / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Continuous webhook scans</span>
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
                <div className="text-xs text-slate-500">For engineering teams</div>
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
                  <span className="font-semibold text-[#000E29]">50 repositories</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>500 scans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>150 migration plans / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>100 draft PRs / month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Multi-seat collaboration</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Slack &amp; Discord alerts</span>
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
                <div className="text-xs text-slate-500">For security-critical scale</div>
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
                  <span>GitHub Enterprise Server</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>SSO &amp; Audit logging</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Dedicated migration engineer</span>
                </div>
              </div>
            </div>

            <Link
              href="/contact"
              className="w-full py-3 rounded-full bg-white border border-black/[0.1] hover:bg-slate-100 text-slate-900 text-xs font-semibold text-center transition-all"
            >
              Contact Enterprise
            </Link>
          </div>

        </div>

        {/* COMPARISON CALLOUT */}
        <div className="rounded-[32px] bg-[#000E29] text-white p-8 md:p-12 space-y-6 shadow-sm">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
              ARCHITECTURAL INTEGRITY
            </span>
            <h2 className="font-serif text-3xl text-white font-normal">
              Every plan includes our 4-gate verification engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We never compromise on safety. Whether you protect 1 repository or 500, every proposed migration passes syntactic validation, TypeScript diagnostics, call-site scope checks, and dry-run tests.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Syntactic Validity</div>
                <div className="text-slate-400 text-[11px]">Zero broken AST nodes</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">TypeScript Diagnostics</div>
                <div className="text-slate-400 text-[11px]">Strict compiler check</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Call-Site Boundary</div>
                <div className="text-slate-400 text-[11px]">Target symbols only</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <GitPullRequest className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Isolated Draft PR</div>
                <div className="text-slate-400 text-[11px]">Human sign-off required</div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ ACCORDION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-8 border-t border-black/[0.06]">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-mono">
              FREQUENTLY ASKED QUESTIONS
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal leading-snug">
              Everything You Need to Know About Pricing &amp; Safety
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Find technical answers about protected repositories, scan limits, GitHub permissions, and our early access policies.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-2.5">
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

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="absolute inset-0 bg-star-pattern opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Protect your repositories from breaking API changes.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect GitHub in seconds. Automatic AST impact detection, verified migration plans, and zero direct branch writes.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
