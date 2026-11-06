import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function UpdatesPage() {
  const updates = [
    {
      date: "March 28, 2026",
      title: "Deterministic AST Matching Engine v2.4",
      description: "We have upgraded our core Abstract Syntax Tree parser with sub-millisecond symbol resolution, parameter-level schema diffing, and support for complex TypeScript call-site expressions.",
      improvements: [
        "Sub-millisecond AST symbol resolution across multi-package monorepos",
        "Parameter rename tracing for object-pattern destructured argument signatures",
        "Full support for TypeScript 5.4 import attributes and path mapping",
        "Zero false positives on unused or type-only third-party imports"
      ],
      footerNote: "Available immediately across all connected GitHub repositories."
    },
    {
      date: "March 14, 2026",
      title: "Four-Gate Migration Verification Pipeline",
      description: "Every automated migration plan now executes through a strict 4-gate safety harness before any draft PR is created, ensuring proposed diffs never violate syntax, types, or tests.",
      improvements: [
        "Gate 1: In-memory AST syntactic validity and indentation consistency check",
        "Gate 2: TypeScript compiler diagnostic check ensuring zero type regressions",
        "Gate 3: Call-site scope boundary verification ensuring isolated diffs",
        "Gate 4: Isolated container dry-run test harness validation"
      ],
      footerNote: "Protects repositories against unsafe hallucinations and unexpected regressions."
    },
    {
      date: "February 28, 2026",
      title: "GitHub App Granular Permissions & Webhook Scans",
      description: "Our GitHub App integration now operates with strict least-privilege permissions: read-only repository tree access for AST analysis and write access strictly isolated to apiproof/* branches.",
      improvements: [
        "Read-only code inspection with zero persistent repository code retention",
        "Automatic scan triggers on dependency lockfile and package.json commits",
        "Instant draft PR creation with full diagnostic diffs and confidence scoring",
        "Seamless repository selector supporting multi-repository organizations"
      ],
      footerNote: "Enhanced security controls for organizations with strict compliance requirements."
    },
    {
      date: "February 12, 2026",
      title: "Expanded Vendor Catalogs: Stripe v18 & OpenAI v4.0",
      description: "Added comprehensive breaking change catalogs for major vendor SDK releases, including Stripe's coupon-to-discounts migration and OpenAI's structured tool calling changes.",
      improvements: [
        "Automated breaking change rule ingestion from vendor release notes and SDK changelogs",
        "Stripe coupon → discounts[] subscription migration rule",
        "OpenAI completion-to-chatCompletions migration rule catalog",
        "Supabase auth helper deprecation and SSR cookie refactoring rules"
      ],
      footerNote: "Monitored catalogs now cover over 50 vendor SDKs and API schemas."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16 outline-none">

        {/* HEADER */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-medium">
            <span>PLATFORM CHANGELOG</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight">
            Product Updates &amp; Engine Changelog
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Continuous improvements to AST matching, vendor API catalogs, verification gates, and GitHub App integrations.
          </p>
        </div>

        {/* TIMELINE FEED */}
        <div className="space-y-16 pt-8">
          {updates.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

              {/* Left Column: Date & Title */}
              <div className="md:col-span-4 space-y-1 relative pl-6 border-l-2 border-black/10 md:border-l-0 md:pl-0">
                <div className="hidden md:flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#000E29]" />
                  <span className="text-xs font-mono text-slate-500">{item.date}</span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-[#000E29] font-medium leading-snug">
                  {item.title}
                </h3>
                <div className="md:hidden text-xs font-mono text-slate-500 pt-1">
                  {item.date}
                </div>
              </div>

              {/* Right Column: Card Content */}
              <div className="md:col-span-8 space-y-6">
                {/* Visual Banner */}
                <div className="h-44 sm:h-52 rounded-2xl bg-[#030B1C] border border-black/[0.08] p-6 flex flex-col items-center justify-center text-white overflow-hidden shadow-xs text-center space-y-2">
                  <span className="font-mono text-xs text-cyan-300">ENGINE UPDATE</span>
                  <div className="font-serif text-2xl sm:text-3xl text-slate-200 font-light px-4">
                    &ldquo;{item.title}&rdquo;
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                    What&apos;s new &amp; improved:
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {item.improvements.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-slate-500 italic pt-2 border-t border-black/[0.05]">
                  {item.footerNote}
                </p>
              </div>

            </div>
          ))}
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
