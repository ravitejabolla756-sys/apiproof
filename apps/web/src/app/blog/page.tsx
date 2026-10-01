import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight } from "lucide-react";

export default function BlogPage() {
  const articles = [
    {
      category: "COMPILER INTERNALS",
      title: "How AST Matching Detects Breaking API Changes",
      date: "March 20, 2026",
      readTime: "7 min read",
      summary: "A deep dive into TypeScript compiler symbol resolution, parameter position matching, and object destructuring diffing across version boundaries.",
      codeSnippet: "ts.createSourceFile('billing.ts', ...)"
    },
    {
      category: "ARCHITECTURE",
      title: "From API Change to Draft PR: The 5-Step Pipeline",
      date: "March 12, 2026",
      readTime: "6 min read",
      summary: "Walking through the deterministic pipeline: vendor changelog parsing, AST symbol tracing, codegen planning, 4-gate verification, and safe draft PR synthesis.",
      codeSnippet: "pipeline: DETECT → TRACE → PLAN → VERIFY → PR"
    },
    {
      category: "SECURITY INVARIANTS",
      title: "Why Safe Automation Stops at the Draft PR",
      date: "February 27, 2026",
      readTime: "5 min read",
      summary: "Exploring our core design invariant: why MY OWL never auto-merges code or pushes to default branches. Developer agency must remain sovereign.",
      codeSnippet: "git push origin apiproof/stripe-v18-update"
    },
    {
      category: "VERIFICATION PIPELINE",
      title: "How MY OWL Verifies a Migration: The 4 Safety Gates",
      date: "February 16, 2026",
      readTime: "6 min read",
      summary: "Detailed review of syntax tree validation, compiler diagnostic passes, call-site scope boundary checks, and isolated dry-run test execution.",
      codeSnippet: "gateCheck: [syntax, tsc, scope, tests]"
    },
    {
      category: "INTEGRATIONS",
      title: "GitHub App Repository Onboarding: Least-Privilege Architecture",
      date: "February 04, 2026",
      readTime: "4 min read",
      summary: "How our GitHub App functions with strictly read-only repository tree access, transient in-memory AST indexing, and zero persistent code storage.",
      codeSnippet: "permissions: { contents: 'read', prs: 'write' }"
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-medium">
            <span>ENGINEERING &amp; RESEARCH</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Engineering Writing on ASTs &amp; Breaking Changes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Technical writeups on compiler AST analysis, vendor API breaking change catalogs, deterministic migration planning, and safe pull request generation.
          </p>
        </div>

        {/* ARTICLES SECTION */}
        <div className="space-y-6">

          {/* 1. FEATURED LARGE ARTICLE */}
          <div className="rounded-[32px] bg-[#EFF1F5] p-8 md:p-10 border border-black/[0.04] grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-xs">
            <div className="md:col-span-6 h-64 md:h-80 rounded-2xl bg-gradient-to-tr from-[#000E29] via-[#00227A] to-[#004EE8] flex flex-col items-center justify-center p-8 text-white relative overflow-hidden text-center space-y-3">
              <div className="text-xs font-mono text-cyan-300">
                CallExpression &gt; PropertyAccess
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-light leading-snug">
                Why API Changes Break Production Code
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                AST Symbol Tracing vs Regex Scanners
              </div>
            </div>

            <div className="md:col-span-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-block px-3 py-1 rounded-full bg-[#000E29] text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                  AST ANALYSIS
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  March 28, 2026 • 8 min read
                </span>
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl text-[#000E29] font-medium leading-snug">
                Why API Changes Break Production Code — And Why Regex Can&apos;t Fix Them
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed">
                Modern applications rely on dozens of vendor APIs. When a provider updates their SDK or modifies parameter structures, standard regex scanners produce massive false positives. We examine how compiler AST symbol graphs detect genuine call-site impact with mathematical certainty.
              </p>

              <div className="pt-2">
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>Read article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* 2. GRID OF TECHNICAL ARTICLES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {articles.map((item, idx) => (
              <div
                key={idx}
                className="rounded-[32px] bg-[#EFF1F5] p-8 border border-black/[0.04] space-y-4 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="h-40 rounded-2xl bg-[#030B1C] border border-black/[0.08] flex flex-col items-center justify-center text-white p-6 text-center space-y-2">
                    <span className="font-mono text-xs text-cyan-300">{item.codeSnippet}</span>
                    <span className="font-serif text-lg text-slate-200">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono font-bold tracking-wider uppercase">
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {item.date} • {item.readTime}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl sm:text-2xl text-[#000E29] font-medium leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-black/[0.05]">
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                    <span>Read article</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
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
