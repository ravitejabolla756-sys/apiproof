'use client';

import React, { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { InteractiveHeroBackground } from "@/components/landing/interactive-hero-background";
import { ScrollPipeline } from "@/components/landing/scroll-pipeline";
import { ArrowRight, ChevronRight, Plus, Minus, ShieldCheck, Lock, Check } from "lucide-react";

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does AST matching detect API breaking changes?",
      a: "Unlike dumb regex string matching or dependency file scanners, MY OWL parses your TypeScript/JavaScript codebase into an Abstract Syntax Tree (AST). It resolves import aliases, call sites, and object property accesses to prove whether your code actually touches a modified API signature or parameter."
    },
    {
      q: "Does MY OWL have write access to my default branch?",
      a: "Never. MY OWL operates on strict read-only observation invariants. When a breaking change is detected and planned, it pushes to an isolated branch (e.g. apiproof/stripe-v18-update) and opens a GitHub Draft Pull Request. It cannot commit directly to main or auto-merge code."
    },
    {
      q: "How does MY OWL verify a migration before opening a Draft PR?",
      a: "Every proposed code patch passes through 4 deterministic verification gates: (1) Syntactic Validity check, (2) TypeScript compiler diagnostic check, (3) Target call-site boundary verification, and (4) Test suite dry-run validation. If any gate fails, the PR is held for diagnostic review."
    },
    {
      q: "Which vendor APIs and SDKs are monitored?",
      a: "MY OWL currently tracks changelogs and breaking changes across Stripe, OpenAI, GitHub REST/GraphQL, Supabase, Twilio, Resend, and major Node.js/TypeScript ecosystem packages. Custom internal API schemas can also be indexed via OpenAPI."
    },
    {
      q: "What is the difference between Detected vs Affected usage?",
      a: "Having a library listed in package.json is simply 'Detected'. Your repository is only classified as 'Affected' if MY OWL's AST symbol tracer finds active call sites, parameter usages, or type references that match the vendor's breaking change catalog."
    },
    {
      q: "How does repository onboarding work?",
      a: "Install the MY OWL GitHub App with one click. Select the repositories you want to protect. MY OWL immediately indexes your dependency graph and sets up webhook triggers for new upstream API changelog releases."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased overflow-x-clip selection:bg-[#D0F100] selection:text-black">
      {/* FLOATING CAPSULE NAVBAR */}
      <LandingNavbar />

      {/* ========================================================================= */}
      {/* 1. HERO SECTION (Visual Foundation + Authentic Product Copy) */}
      {/* ========================================================================= */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center pt-32 pb-24 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(180deg,#001033_0%,#004EE8_55%,#58B8F6_90%,#FAFAFA_100%)]">
        {/* Interactive Cursor-Following Diagonal Lines & Spotlight Background */}
        <InteractiveHeroBackground />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 flex flex-col items-center">

          {/* Announcement pill badge */}
          <Link
            href="/updates"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/50 border border-white/15 backdrop-blur-md text-xs text-white transition-all shadow-lg group"
          >
            <span className="px-2 py-0.5 rounded-full bg-black text-[10px] font-bold tracking-wider uppercase text-white border border-white/10">
              GITHUB APP
            </span>
            <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
              CONTINUOUS BREAKING CHANGE INTELLIGENCE
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
          </Link>

          {/* Large Serif Headline */}
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white max-w-3xl leading-[1.08] drop-shadow-sm">
            Your APIs change.<br />
            Your code shouldn&apos;t fail silently.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-200 max-w-xl font-normal leading-relaxed">
            MY OWL detects API changes, traces their impact through your codebase, plans the migration, and opens a verified draft PR.
          </p>

          {/* Dual CTAs: Primary Neon Lime + Secondary Ghost Pill */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/login"
              className="btn-lime text-sm sm:text-base px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95"
            >
              <span>Connect GitHub</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>

            <Link
              href="/how-it-works"
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md text-white text-sm font-medium transition-all"
            >
              See how it works
            </Link>
          </div>

          <div className="pt-2 flex items-center gap-4 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-cyan-400" /> Read-only code inspection
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Human-in-the-loop review
            </span>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SCROLL-DRIVEN PIPELINE STORY: Detect → Trace → Plan → Verify           */}
      {/* ========================================================================= */}
      <ScrollPipeline />

      {/* ========================================================================= */}
      {/* 4. MONITORED API ECOSYSTEMS (Real Provider Catalogs, No Fake Testimonials) */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#000E29] text-white py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-star-pattern opacity-30 pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-16 relative z-10">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold tracking-wider text-cyan-400 uppercase font-mono">
                UPSTREAM MONITORING INTELLIGENCE
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl text-white font-normal leading-snug">
                Monitored Vendor API Ecosystems
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Continuous changelog tracking, AST rule indexing, and deterministic breaking change catalogs across mission-critical providers.
              </p>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Active Catalogs: <span className="text-white font-semibold">50+ Vendor SDKs</span>
            </div>
          </div>

          {/* Provider Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Provider 1: Stripe */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">Stripe</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">REST + Node SDK</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Indexed coupon deprecations, subscription item transforms, invoice upcoming parameters, and webhook signature revisions.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 14 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

            {/* Provider 2: OpenAI */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">OpenAI</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">Responses + Python/Node</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Monitors model deprecation schedules, structured output parameter changes, embedding dimensions, and tool calling schemas.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 19 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

            {/* Provider 3: GitHub */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">GitHub API</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">REST / Octokit</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Indexes Octokit v20+ request options, authentication header migrations, repository dispatch schema changes, and pagination limits.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 12 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

            {/* Provider 4: Supabase */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">Supabase</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">supabase-js v2</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tracks auth helper refactors, real-time channel subscription changes, SSR cookie management upgrades, and PostgREST filters.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 16 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

            {/* Provider 5: Twilio */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">Twilio</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">Messaging + Voice</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Detects messaging service webhook changes, toll-free verification payload migrations, and call recording API status updates.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 9 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

            {/* Provider 6: Resend */}
            <div className="rounded-3xl bg-[#061434] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">Resend</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">Email API</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Monitors batch email parameters, audience subscription headers, domain verification schemas, and webhook payload structures.
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rules: 8 breaking patterns</span>
                <span className="text-emerald-400">Monitored</span>
              </div>
            </div>

          </div>

          <div className="pt-8 text-center">
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors"
            >
              <span>Read the docs on supported vendor changelogs &amp; AST rules</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D0F100]" />
            </Link>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. PRICING SECTION (Authentic MY OWL Repositories-Protected Model) */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              TRANSPARENT DEVELOPER PRICING
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#000E29] font-normal leading-tight">
              Protected Repositories, No Noise
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Choose a tier scaled by the number of repositories you protect. Free during developer early access.
            </p>
          </div>
          <Link
            href="/pricing"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 shrink-0"
          >
            <span>Compare all plan features</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Pricing Cards: Free, Pro, Team, Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">

          {/* Tier 1: Free */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Free</div>
                <div className="text-xs text-slate-500">For individuals &amp; hobby projects</div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-normal text-[#000E29]">$0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">Free forever</div>
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

          {/* Tier 2: Pro */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 flex flex-col justify-between border-2 border-black/[0.1] relative space-y-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Pro</div>
                  <div className="text-xs text-slate-500">For fast-moving developers</div>
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
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
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
                  <span>Slack / Discord alerts</span>
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
          <div className="rounded-[32px] bg-[#EFF1F5] p-7 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs">
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
                  <span>GitHub Enterprise Server</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>SSO &amp; Audit logging</span>
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
              Contact Enterprise
            </Link>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TECHNICAL FAQ (Honest Developer Answers, No Generic Marketing) */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          {/* Left Info */}
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-mono">
              FREQUENTLY ASKED QUESTIONS
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal leading-snug">
              Everything You Need to Know Before Connecting
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Technical specifics on AST parsing, security boundaries, verification gates, and repository permissions.
            </p>
          </div>

          {/* Right Accordion */}
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
      </section>

      {/* ========================================================================= */}
      {/* 7. AUTHENTIC ENGINEERING ARTICLES (MY OWL Topics) */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase font-mono">
              ENGINEERING WRITING
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000E29] font-normal">
              Technical Notes on Breaking Changes &amp; AST Analysis
            </h2>
          </div>
          <Link
            href="/blog"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 shrink-0"
          >
            <span>View all articles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Blog Cards */}
        <div className="space-y-6">

          {/* Featured Large Card */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-8 md:p-10 border border-black/[0.04] grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-xs">
            <div className="md:col-span-6 h-56 rounded-2xl bg-gradient-to-tr from-[#000E29] to-[#004EE8] flex items-center justify-center p-6 text-white overflow-hidden relative">
              <div className="font-mono text-xs text-cyan-300 text-center space-y-2">
                <div>AST Pattern Matching</div>
                <div className="text-slate-400 font-sans text-sm">CallExpression &gt; PropertyAccessExpression</div>
              </div>
            </div>

            <div className="md:col-span-6 space-y-3">
              <span className="px-3 py-1 rounded-full bg-[#000E29] text-white text-[10px] font-bold tracking-wider uppercase font-mono">
                ENGINEERING ARCHITECTURE
              </span>
              <h3 className="font-serif text-2xl text-[#000E29] font-medium leading-snug">
                How AST Matching Distinguishes Detected Dependencies from Affected Code
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                March 2026 • 6 min read
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Why package.json scanners generate 90% false positives, and how parsing call expressions into AST symbols enables zero-noise compatibility verification.
              </p>
            </div>
          </div>

          {/* 2 Bottom Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-3 shadow-xs">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold tracking-wider uppercase font-mono">
                SECURITY &amp; TRUST
              </span>
              <h3 className="font-serif text-xl text-[#000E29] font-medium leading-snug">
                Why Safe Automation Stops at the Draft PR
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                February 2026 • 5 min read
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Exploring the architectural invariants behind MY OWL: why we never commit directly to default branches or auto-merge code without human developer sign-off.
              </p>
            </div>

            <div className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-3 shadow-xs">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold tracking-wider uppercase font-mono">
                VERIFICATION PIPELINE
              </span>
              <h3 className="font-serif text-xl text-[#000E29] font-medium leading-snug">
                How MY OWL Verifies a Migration: The 4-Gate Safety Pipeline
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                January 2026 • 4 min read
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                A breakdown of syntactic validation, compiler diagnostics, call-site scoping, and dry-run test execution that protects against hallucinated refactors.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. PRE-FOOTER RADIANT GRADIENT CTA */}
      {/* ========================================================================= */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="absolute inset-0 bg-star-pattern opacity-60 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-tight">
            Stop silent API breakage before it reaches production.
          </h2>

          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect your repository in seconds. Read-only AST observation, deterministic migration planning, and safe draft PRs.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime text-sm sm:text-base px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. DARK FOOTER */}
      {/* ========================================================================= */}
      <LandingFooter />

    </div>
  );
}
