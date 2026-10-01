import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, Terminal } from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    {
      step: "01",
      title: "Install GitHub App & Map Dependencies",
      badge: "INGESTION",
      desc: "Connect your organization with one click. MY OWL receives webhooks on push events and indexes your package manifests and internal symbol export maps.",
      code: "myowl/github-app: authorized for [repo: web-api, repo: billing-service]"
    },
    {
      step: "02",
      title: "Monitor Upstream API Releases",
      badge: "INTELLIGENCE",
      desc: "Our engine tracks official vendor release feeds (Stripe, OpenAI, Supabase, Twilio) and turns deprecation notices into actionable, machine-readable AST change rules.",
      code: "RULE: Stripe API v18 -> params.customer.tax_id deprecated in favor of tax_ids[]"
    },
    {
      step: "03",
      title: "Trace Real Call-Site Impact via AST",
      badge: "SYMBOL RESOLUTION",
      desc: "Instead of simplistic keyword matching, our parser navigates your Abstract Syntax Tree to verify whether your code actually invokes affected symbols or parameter configurations.",
      code: "AST MATCH: src/lib/billing.ts:42 -> stripe.customers.create({ tax_id })"
    },
    {
      step: "04",
      title: "Execute 4-Gate Verification Harness",
      badge: "ZERO-DEFECT GATING",
      desc: "Before any code is proposed, the generated patch must pass: (1) Syntactic Validity, (2) TypeScript Compiler Checks, (3) Call-Site Boundary Checks, and (4) Test Dry-Runs.",
      code: "VERIFICATION: [PASS] Syntax -> [PASS] TSC Check -> [PASS] Boundary -> [PASS] Tests"
    },
    {
      step: "05",
      title: "Open Isolated Draft Pull Request",
      badge: "HUMAN OVERSIGHT",
      desc: "MY OWL branches into apiproof/vendor-update and submits a GitHub Draft PR complete with side-by-side diffs, migration rationale, and documentation links for your team to review.",
      code: "GITHUB: Draft PR #142 opened: 'chore(deps): migrate Stripe customer creation to v18'"
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>DETERMINISTIC PIPELINE</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            From Breaking Change to Verified Draft PR
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            How MY OWL monitors, traces, verifies, and proposes safe migration patches without ever auto-merging or touching your production branches.
          </p>
        </div>

        {/* TIMELINE STEPS */}
        <div className="space-y-6">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-[28px] bg-[#EFF1F5] p-6 sm:p-8 border border-black/[0.04] shadow-xs relative overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-white px-2.5 py-1 rounded-md border border-black/[0.06]">
                      STEP {item.step}
                    </span>
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-normal text-[#000E29]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="lg:col-span-5">
                  <div className="rounded-xl bg-[#001033] p-4 text-xs font-mono text-slate-200 border border-white/10 shadow-inner overflow-x-auto">
                    <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-[#D0F100]" />
                      <span>Pipeline execution</span>
                    </div>
                    <code className="text-[#A5D4FF] block whitespace-pre-wrap leading-relaxed">
                      {item.code}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            See MY OWL in action on your repositories.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Free developer early access. Connect your GitHub repositories in 60 seconds with strict read-only observation.
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
