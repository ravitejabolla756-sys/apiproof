import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, Code2, ShieldCheck, Lock } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16 outline-none">

        {/* EDITORIAL HERO */}
        <div className="rounded-[32px] bg-[#EFF1F5] border border-black/[0.04] p-8 md:p-14 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* Left 5 cols */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
                <span>OUR MISSION</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#000E29] leading-[1.12]">
                Your APIs change.<br />
                <span className="italic font-normal">Your code shouldn&apos;t fail silently.</span>
              </h1>
            </div>

            {/* Right 7 cols */}
            <div className="lg:col-span-7 space-y-5 text-slate-700 text-sm sm:text-base leading-relaxed">
              <p className="text-base sm:text-lg text-[#000E29] font-medium leading-snug">
                MY OWL gives engineering teams continuous clarity on whether upstream API, SDK, and package changes actually break their codebase.
              </p>
              <p>
                Modern applications rely on dozens of vendor APIs—from payment processors like Stripe to communications providers like Twilio and AI infrastructure providers like OpenAI. When a vendor updates their SDK or deprecates a parameter, software teams face a silent dilemma: spend hours auditing every call site manually, or risk breaking production.
              </p>
              <p>
                MY OWL bridges this gap by indexing repository Abstract Syntax Trees (ASTs), matching reviewed vendor breaking change rules to actual symbol usages, and executing 4-gate verification pipelines before generating human-reviewable draft pull requests.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="btn-lime min-h-11 text-xs font-semibold px-6 py-3 shadow-[0_0_24px_rgba(208,241,0,0.35)] inline-flex items-center gap-2"
                >
                  <span>Connect GitHub</span>
                  <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* 3 CORE PILLARS */}
        <div className="space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono font-semibold tracking-wider text-slate-600 uppercase">
              ARCHITECTURAL PRINCIPLES
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal">
              Built for Developer Trust &amp; Production Safety
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center text-slate-900 shadow-xs">
                  <Code2 aria-hidden="true" className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-[#000E29] font-medium">
                  Deterministic AST Matching
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  We parse source code into formal Abstract Syntax Trees. We never guess with regex or simple string searches. If an API signature changes, we trace exact call expressions.
                </p>
              </div>
              <div className="pt-4 border-t border-black/[0.05] text-[11px] font-mono text-slate-600">
                AST symbol tracing
              </div>
            </div>

            <div className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center text-slate-900 shadow-xs">
                  <ShieldCheck aria-hidden="true" className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-[#000E29] font-medium">
                  4-Gate Verification
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Every proposed migration is verified against syntactic validity, TypeScript compiler diagnostics, call-site scope boundaries, and isolated dry-run test execution.
                </p>
              </div>
              <div className="pt-4 border-t border-black/[0.05] text-[11px] font-mono text-slate-600">
                Compiler + test checks
              </div>
            </div>

            <div className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center text-slate-900 shadow-xs">
                  <Lock aria-hidden="true" className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-[#000E29] font-medium">
                  Human Sovereign Review
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  We never commit to your default branch. We never auto-merge. Automated changes are delivered as isolated GitHub Draft Pull Requests for engineers to inspect and approve.
                </p>
              </div>
              <div className="pt-4 border-t border-black/[0.05] text-[11px] font-mono text-slate-600">
                Draft PR boundary
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="absolute inset-0 bg-star-pattern opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Stop silent API breakage before it reaches production.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect your repository in seconds. Read-only AST observation, deterministic migration planning, and safe draft PRs.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
                  className="btn-lime min-h-11 text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight aria-hidden="true" className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
