'use client';

import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { InteractiveHeroBackground } from "@/components/landing/interactive-hero-background";
import { ScrollPipeline } from "@/components/landing/scroll-pipeline";
import { ProductVideo } from "@/components/landing/product-video";
import { CURRENT_BETA_CAPABILITIES, DETECTION_ONLY_BETA_MESSAGE } from "@/lib/beta-capabilities";
import {
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Lock,
  Check,
  GitBranch,
  CheckCircle2
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#000E29] font-sans antialiased overflow-x-clip selection:bg-[#D0F100] selection:text-black">
      {/* FLOATING CAPSULE NAVBAR */}
      <LandingNavbar />

      {/* ========================================================================= */}
      {/* 01. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-start pt-28 sm:pt-36 pb-20 sm:pb-24 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(180deg,#001033_0%,#002B80_15%,#004EE8_38%,#3B9EF8_60%,#68BCF9_74%,#96D0FB_85%,#BDE3FC_92%,#D8EEFD_96.5%,#EEF5FF_100%)]">
        {/* Interactive Spotlight & Background */}
        <InteractiveHeroBackground />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 flex flex-col items-center">
          {/* Badge */}
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/50 border border-white/15 backdrop-blur-md text-xs text-white transition-all shadow-lg group"
          >
            <span className="px-2 py-0.5 rounded-full bg-[#D0F100] text-[10px] font-bold tracking-wider uppercase text-black">PUBLIC BETA</span>
            <span className="px-2 py-0.5 rounded-full bg-black text-[10px] font-bold tracking-wider uppercase text-white border border-white/10 font-mono">
              GITHUB APP
            </span>
            <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
              CONTINUOUS BREAKING CHANGE INTELLIGENCE
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
          </Link>

          {/* Headline */}
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white max-w-3xl leading-[1.08] drop-shadow-sm">
            Stop silent API breakage before it reaches production.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-100 max-w-2xl font-normal leading-relaxed">
            Know when the APIs your code depends on are about to break. MY OWL checks repositories against reviewed provider deprecations and breaking changes, then shows the evidence for human review.
          </p>
          <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed">Public beta with {CURRENT_BETA_CAPABILITIES.reviewedProviderCount} reviewed providers and {CURRENT_BETA_CAPABILITIES.reviewedRuleCount} evidence-linked compatibility rules. {DETECTION_ONLY_BETA_MESSAGE}</p>

          {/* CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/login"
              className="btn-lime text-sm sm:text-base px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 font-semibold"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>

            <Link
              href="/how-it-works"
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md text-white text-sm font-medium transition-all"
            >
              See how it works
            </Link>
          </div>

          {/* Trust Invariants */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-xs font-mono text-slate-200">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-300" /> Read-only code inspection
            </span>
            <span className="text-white/30 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-blue-200" /> Evidence-linked compatibility rules
            </span>
            <span className="text-white/30 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Zero auto-merge
            </span>
            <span className="text-white/30 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-lime-300" /> Human review boundary
            </span>
          </div>

          {/* Lightweight Horizontal Conceptual Pipeline Sequence (No Giant Box) */}
          <div className="pt-10 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-6 gap-y-2 font-mono text-xs text-white/70">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D0F100] animate-pulse" />
              <span className="text-white font-semibold">DETECT</span>
            </span>
            <span className="text-white/30">→</span>
            <span className="text-slate-200">TRACE</span>
            <span className="text-white/30">→</span>
            <span className="text-slate-200">EXPLAIN</span>
            <span className="text-white/30">→</span>
            <span className="text-slate-200 font-semibold">REVIEW</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02. THE PROBLEM (Two-Column Editorial Composition)                        */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left: Editorial Statement */}
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold tracking-wider text-[#004EE8] uppercase font-mono">
              THE REAL ENGINEERING PROBLEM
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#000E29] font-normal leading-[1.12]">
              An API change is only the beginning.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-sans">
              When a vendor announces a breaking change or deprecates a parameter, the announcement itself solves nothing. The engineering team is left with an urgent investigation across dozens of repositories.
            </p>
          </div>

          {/* Right: Three Numbered Observations with Thin Horizontal Rules */}
          <div className="lg:col-span-7 divide-y divide-slate-200 font-sans">
            <div className="pb-8 space-y-2">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-2xl font-serif text-[#004EE8]">01</span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  MANIFEST RESOLUTION
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#000E29] tracking-tight">
                Which repositories are affected?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Package manifests show installed dependencies and pinned versions, but cannot confirm if the deprecated method is part of an active execution path.
              </p>
            </div>

            <div className="py-8 space-y-2">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-2xl font-serif text-[#004EE8]">02</span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  CALL-SITE ISOLATION
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#000E29] tracking-tight">
                Which call sites actually break?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Text search creates endless false positives from comments, mocks, and unrelated variables. Only compiler-grade Abstract Syntax Tree (AST) analysis isolates the true call sites.
              </p>
            </div>

            <div className="pt-8 space-y-2">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-2xl font-serif text-[#004EE8]">03</span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  SAFE TRANSFORMATION
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#000E29] tracking-tight">
                Which exact usage needs attention?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Linking reviewed provider evidence to exact repository usage so your engineering team can decide the next change safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 03. THE TRANSFORMATION (Editorial Statement & Flow)                       */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-b border-slate-200">
        <div className="space-y-12">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#004EE8] uppercase font-mono">
              THE WORKFLOW
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#000E29] font-normal leading-tight">
              From upstream change to reviewed code.
            </h2>
          </div>

          {/* Simple Horizontal Flow with Typography and Subtle Lines */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 font-mono text-xs">
            <div className="border-l-2 border-slate-300 pl-4 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">01 INGEST</span>
              <div className="font-bold text-[#000E29] text-sm font-sans">Upstream Change</div>
              <p className="text-slate-500 font-sans text-xs">Vendor changelog parsed</p>
            </div>

            <div className="border-l-2 border-slate-300 pl-4 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">02 TRACE</span>
              <div className="font-bold text-[#000E29] text-sm font-sans">Affected Call Site</div>
              <p className="text-slate-500 font-sans text-xs">ts-morph AST analysis</p>
            </div>

            <div className="border-l-2 border-slate-300 pl-4 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">03 EXPLAIN</span>
              <div className="font-bold text-[#000E29] text-sm font-sans">Compatibility Proof</div>
              <p className="text-slate-500 font-sans text-xs">Rule, source, and usage evidence</p>
            </div>

            <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
              <span className="text-[10px] text-emerald-700 uppercase tracking-widest font-bold">04 REVIEW</span>
              <div className="font-bold text-[#000E29] text-sm font-sans">Engineering Decision</div>
              <p className="text-slate-500 font-sans text-xs">Human review remains required</p>
            </div>
          </div>

          {/* Small Technical Code Fragment */}
          <div className="pt-6 font-mono text-xs text-slate-700">
            <div className="text-[11px] text-slate-400 pb-2">// src/billing.ts:42</div>
            <div className="space-y-1">
              <div className="text-rose-700 font-medium">- coupon: promoCouponId</div>
              <div className="text-emerald-700 font-medium">+ discounts: [&#123; coupon: promoCouponId &#125;]</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 04. SCROLL STORY (Detect → Trace → Plan → Verify)                         */}
      {/* ========================================================================= */}
      <ScrollPipeline />

      {/* ========================================================================= */}
      {/* 05. VIDEO SECTION (See MY OWL Work)                                       */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#000511] text-white py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-y border-white/10">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-wider text-cyan-400 uppercase font-mono">
              MY OWL WORKFLOW
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl font-normal tracking-tight">
              See MY OWL work.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 font-sans leading-relaxed">
              From an upstream breaking change to evidence your team can review.
            </p>
          </div>

          {/* Reusable YouTube-Ready Product Film Component */}
          <ProductVideo />

          <p className="text-center text-xs sm:text-sm text-slate-400 font-sans">
            Watch the complete workflow on a real repository.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 06. WHY IT IS DIFFERENT (DEPENDENCY ≠ USAGE)                              */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-semibold tracking-wider text-[#004EE8] uppercase font-mono">
              DEPENDENCY ≠ USAGE
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal leading-snug">
              Dependency presence is not the same as affected usage.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-sans">
              Having Stripe in your <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-800">package.json</code> does not mean the deprecated parameter is used.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed font-sans">
              MY OWL parses your TypeScript and JavaScript source files into an Abstract Syntax Tree using <span className="font-semibold text-slate-900">ts-morph</span>. It traces variable bindings and inspects argument object literals to verify whether your code actually touches a modified signature.
            </p>
            <div className="pt-2 font-mono text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span className="text-slate-700">package.json</span>
              <span>→</span>
              <span className="text-slate-700">import</span>
              <span>→</span>
              <span className="text-slate-700">call expression</span>
              <span>→</span>
              <span className="text-[#004EE8] font-bold">affected parameter</span>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6 lg:pl-6 lg:border-l lg:border-slate-200 font-mono text-xs">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                DETERMINISTIC CODEGEN. NOT GENERATED GUESSWORK.
              </p>
              <h3 className="font-serif text-2xl text-[#000E29] font-normal font-sans">
                Predictable AST transformations.
              </h3>
              <p className="text-xs text-slate-600 font-sans leading-relaxed">
                MY OWL does not prompt an LLM to guess what your code should look like. This beta reports validated, rule-driven compatibility evidence against your exact source baseline.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block pb-1">DETECTED USAGE</span>
                <div className="text-rose-700 font-semibold bg-rose-50/70 p-2.5 rounded border border-rose-100">
                  model: "gpt-4.5-preview"
                </div>
              </div>

              <div className="text-center text-slate-400 font-bold">↓</div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block pb-1">REVIEWED RULE</span>
                <div className="text-emerald-800 font-semibold bg-emerald-50/70 p-2.5 rounded border border-emerald-100">
                  OpenAI model retirement · evidence linked
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 07. SAFETY (Detection-only public beta)                                    */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-b border-slate-200 space-y-12">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold tracking-wider text-[#004EE8] uppercase font-mono">
            VERIFICATION BOUNDARY
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal leading-snug">
            Detection first. Engineering decisions stay with your team.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed font-sans">
            The public beta is read-only: it reports reviewed compatibility evidence and never creates branches, patches, or pull requests.
          </p>
        </div>

        {/* Single Horizontal Verification Sequence */}
        <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-2 pt-2 pb-6 border-b border-slate-100 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <span className="font-bold text-[#000E29]">AST</span>
              <span className="text-slate-500 block text-[11px]">Valid Syntax</span>
            </div>
          </div>
          <span className="text-slate-300 hidden sm:inline">→</span>

          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <span className="font-bold text-[#000E29]">TYPES</span>
              <span className="text-slate-500 block text-[11px]">tsc --noEmit clean</span>
            </div>
          </div>
          <span className="text-slate-300 hidden sm:inline">→</span>

          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <span className="font-bold text-[#000E29]">SCOPE</span>
              <span className="text-slate-500 block text-[11px]">Call-site bounded</span>
            </div>
          </div>
          <span className="text-slate-300 hidden sm:inline">→</span>

          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <div>
              <span className="font-bold text-[#000E29]">TESTS</span>
              <span className="text-slate-500 block text-[11px]">Dry-run exit 0</span>
            </div>
          </div>
          <span className="text-slate-300 hidden sm:inline">→</span>

          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <span className="text-emerald-700 font-bold text-sm">✓</span>
            <span className="font-bold text-emerald-900">HUMAN REVIEW</span>
          </div>
        </div>

        {/* Core Invariant Statement */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-600 pt-2">
          <span>Zero repository writes (<code className="text-slate-900">main</code> remains read-only)</span>
          <span>•</span>
          <span>Zero auto-merge (human review required)</span>
          <span>•</span>
          <span className="text-emerald-700 font-semibold">Fail closed on uncertainty</span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 08. PRICING (Clean, Minimal Plan Columns)                                 */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-mono">
              DETECTION-ONLY BETA
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#000E29] font-normal leading-tight">
              Evidence, Not Repository Writes
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-sans">
              Free during the public beta. Paid limits and migration capabilities are not active yet.
            </p>
          </div>
          <Link
            href="/pricing"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 shrink-0 font-mono"
          >
            <span>Read beta access details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Clean Plan Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* Beta access */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-800 font-sans">Beta Access</div>
                <div className="text-xs text-slate-500 font-sans">For approved beta users</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                <span className="text-xs text-slate-500 font-mono">/ mo</span>
              </div>
              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700 font-sans">
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
                  <span>Reviewed compatibility evidence</span>
                </div>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all font-sans"
            >
              Request Beta Access
            </Link>
          </div>

          {/* Provider coverage */}
          <div className="p-7 rounded-2xl bg-white border-2 border-[#004EE8] flex flex-col justify-between relative space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 font-sans">Provider Coverage</div>
                  <div className="text-xs text-slate-500 font-sans">Reviewed compatibility evidence</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#004EE8] text-white text-[10px] font-bold tracking-wider uppercase font-mono">
                  CURRENT BETA
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                <span className="text-xs text-slate-500 font-mono">/ mo</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold font-mono uppercase tracking-wide">Reviewed rules only</div>
              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700 font-sans">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span className="font-semibold text-[#000E29]">{CURRENT_BETA_CAPABILITIES.reviewedProviderCount} reviewed providers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>{CURRENT_BETA_CAPABILITIES.reviewedRuleCount} reviewed compatibility rules</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>AFFECTED, NOT_AFFECTED, and NEEDS_REVIEW outcomes</span>
                </div>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-full bg-[#004EE8] hover:bg-[#003BB5] text-white text-xs font-semibold text-center transition-all font-sans shadow-sm"
            >
              Explore the Beta
            </Link>
          </div>

          {/* Team review */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-800 font-sans">Team Review</div>
                <div className="text-xs text-slate-500 font-sans">Use evidence in your workflow</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                <span className="text-xs text-slate-500 font-mono">/ mo</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold font-mono uppercase tracking-wide">No paid quotas</div>
              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700 font-sans">
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
                  <span>Human-owned remediation</span>
                </div>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold text-center transition-all font-sans"
            >
              Join the Beta
            </Link>
          </div>

          {/* Future enterprise interest */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-800 font-sans">Future Enterprise</div>
                <div className="text-xs text-slate-500 font-sans">Requirements intake only</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-2xl font-normal text-[#000E29]">Not priced yet</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Share future requirements</div>
              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700 font-sans">
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
                  <span>Migration capabilities are planned, not included</span>
                </div>
              </div>
            </div>
            <Link
              href="/contact"
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold text-center transition-all font-sans"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 09. FINAL CTA                                                             */}
      {/* ========================================================================= */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="absolute inset-0 bg-star-pattern opacity-60 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-tight">
            Stop finding breaking changes after production finds them.
          </h2>

          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed font-sans">
            Connect your repository in seconds for read-only AST observation and evidence-linked compatibility findings.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime text-sm sm:text-base px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 font-semibold"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <LandingFooter />
    </div>
  );
}
