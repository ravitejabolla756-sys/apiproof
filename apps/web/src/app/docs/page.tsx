import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, Terminal, ChevronRight } from "lucide-react";

export default function DocsPage() {
  const docSections = [
    {
      title: "Getting Started",
      description: "Quickly install the MY OWL GitHub App, select repositories to monitor, and run your first AST scan.",
      topics: [
        "GitHub App Installation & Scopes",
        "Selecting Protected Repositories",
        "Initial Repository Indexing Pass",
        "Webhook Event Triggers"
      ]
    },
    {
      title: "AST Matching Engine",
      description: "Understanding how our TypeScript/JavaScript compiler engine distinguishes between detected packages and affected call sites.",
      topics: [
        "TypeScript Compiler API Overview",
        "Symbol Resolution & Import Aliases",
        "Destructured Parameter Tracking",
        "Detected vs. Affected Classification"
      ]
    },
    {
      title: "4-Gate Verification Harness",
      description: "Deep dive into the four safety gates that validate proposed migration patches before any draft PR is created.",
      topics: [
        "Gate 1: Syntactic Validity Check",
        "Gate 2: TypeScript Compiler Diagnostics",
        "Gate 3: Call-Site Boundary Verification",
        "Gate 4: Automated Test Suite Dry-Run"
      ]
    },
    {
      title: "Configuration & .myowl.yml",
      description: "Fine-tune branch naming, path exclusions, custom test runner commands, and migration heuristics.",
      topics: [
        "Repository Config Schema Reference",
        "Custom Branch Prefix: apiproof/*",
        "Excluding Test Fixtures & Vendors",
        "Notification Webhooks & Slack Alerts"
      ]
    },
    {
      title: "Security & Data Governance",
      description: "Our strict zero code retention policy, read-only observation invariants, and enterprise compliance posture.",
      topics: [
        "Ephemeral In-Memory AST Analysis",
        "Scoped Read-Only Repository Access",
        "Isolated Branch Write Invariants",
        "SOC 2 Type II Alignment"
      ]
    },
    {
      title: "Monitored Ecosystems",
      description: "Supported vendor APIs, SDKs, and npm packages tracked in our continuous breaking change catalog.",
      topics: [
        "Stripe API & Stripe Node SDK",
        "OpenAI API & Official Clients",
        "Supabase JS / PostgREST APIs",
        "Custom OpenAPI 3.0 Schemas"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>DEVELOPER DOCUMENTATION</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            MY OWL Documentation
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Everything you need to understand, configure, and operate continuous breaking change intelligence across your codebases.
          </p>
        </div>

        {/* QUICKSTART CODE CALLOUT */}
        <div className="rounded-[28px] bg-[#001033] border border-white/10 p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#D0F100] mb-1">
                <Terminal className="w-4 h-4" />
                <span>QUICKSTART INTEGRATION</span>
              </div>
              <h2 className="font-serif text-2xl font-normal text-white">
                Zero-Config Continuous Monitoring
              </h2>
            </div>
            <Link
              href="/login"
              className="btn-lime text-xs px-5 py-2.5 shadow-[0_0_20px_rgba(208,241,0,0.35)] shrink-0 self-start md:self-auto"
            >
              Install GitHub App
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <div className="text-xs font-mono text-slate-400">01 / INSTALL</div>
              <div className="text-sm font-medium text-white">Authorize GitHub App</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Connect via GitHub OAuth with read-only repository metadata scopes.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-mono text-slate-400">02 / INDEX</div>
              <div className="text-sm font-medium text-white">Select Repositories</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                MY OWL inspects your manifests and indexes existing vendor API call sites.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-mono text-slate-400">03 / MONITOR</div>
              <div className="text-sm font-medium text-white">Receive Verified PRs</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                When upstream APIs break, you receive verified draft PRs automatically.
              </p>
            </div>
          </div>
        </div>

        {/* DOCS TOPIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {docSections.map((section) => (
            <div
              key={section.title}
              className="rounded-[28px] bg-[#EFF1F5] p-7 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs hover:border-black/[0.1] transition-all"
            >
              <div className="space-y-3">
                <h3 className="font-serif text-2xl font-normal text-[#000E29]">
                  {section.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {section.description}
                </p>
              </div>

              <div className="pt-2 border-t border-black/[0.06] space-y-2">
                {section.topics.map((topic) => (
                  <div key={topic} className="flex items-center justify-between text-xs text-slate-700 py-1 border-b border-black/[0.03] last:border-0">
                    <span className="font-medium">{topic}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Ready to protect your production APIs?
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Start free with full developer access. Zero auto-merges, strict AST safety.
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
