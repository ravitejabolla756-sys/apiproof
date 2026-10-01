import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, Code2, ShieldCheck, CheckCircle2, Cpu, GitPullRequest, Search, FileCode } from "lucide-react";

export default function FeaturesPage() {
  const features = [
    {
      icon: Cpu,
      title: "Deterministic AST Analysis",
      tag: "COMPILER CORE",
      description: "Parses your TypeScript and JavaScript codebases into an Abstract Syntax Tree. Resolves import aliases, call sites, and destructured object parameters to eliminate false alarms and accurately pinpoint real breakages.",
      details: ["TypeScript compiler API integration", "Destructured property tracking", "Aliased import resolution", "Zero naive regex matches"]
    },
    {
      icon: ShieldCheck,
      title: "4-Gate Verification Harness",
      tag: "SAFETY GUARANTEE",
      description: "Every proposed migration patch executes through four deterministic verification gates before a draft PR is opened, ensuring no invalid code ever lands in your repository.",
      details: ["Syntactic validity verification", "TypeScript compiler diagnostic check", "Target call-site boundary check", "Test suite dry-run validation"]
    },
    {
      icon: Search,
      title: "Detected vs. Affected Distinction",
      tag: "ZERO NOISE",
      description: "Having an outdated dependency in package.json is merely 'Detected'. MY OWL only alerts your team when AST symbol tracing confirms active, affected call sites in your actual code.",
      details: ["Call-site reachability verification", "No dependency alert fatigue", "Real impact scoring", "Prioritized migration queues"]
    },
    {
      icon: GitPullRequest,
      title: "Isolated Draft Pull Requests",
      tag: "HUMAN OVERSIGHT",
      description: "MY OWL adheres to strict read-only observation invariants. It pushes changes exclusively to isolated branches (e.g., apiproof/stripe-v18) and opens a GitHub Draft PR with detailed rationale.",
      details: ["Never writes to main branch", "Zero auto-merge policy", "Interactive side-by-side diffs", "Complete migration rationale notes"]
    },
    {
      icon: FileCode,
      title: "Multi-Vendor Changelog Ingestion",
      tag: "INTELLIGENCE",
      description: "Tracks breaking change releases across Stripe, OpenAI, GitHub, Supabase, Twilio, Resend, and core Node.js/TypeScript packages with custom internal API support via OpenAPI schemas.",
      details: ["Automated changelog parsing", "Semantic versioning diffing", "OpenAPI/Swagger schema support", "Daily upstream rule updates"]
    },
    {
      icon: Code2,
      title: "Zero Source Code Retention",
      tag: "ENTERPRISE SECURITY",
      description: "Your codebase is parsed ephemerally in-memory. MY OWL never stores your source code on our servers, ensuring total intellectual property protection and SOC 2 compliance readiness.",
      details: ["Ephemeral in-memory AST parse", "GitHub App permission scoping", "Encrypted metadata storage", "Auditable activity logs"]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>CORE CAPABILITIES</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Engineered for AST Precision, Not Guesswork
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Explore the compiler-grade analysis, automated verification gates, and continuous monitoring tools that keep your API integrations unbroken.
          </p>
        </div>

        {/* FEATURES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-[28px] bg-[#EFF1F5] p-7 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs hover:border-black/[0.1] transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#001033] shadow-xs border border-black/[0.06]">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase bg-black/[0.04] px-2.5 py-1 rounded-full">
                      {feature.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-2xl font-normal text-[#000E29] leading-snug">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-black/[0.06] space-y-2">
                  {feature.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Protect your code from silent API failures.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect your repositories in 60 seconds with our official GitHub App. Zero configuration required to start scanning.
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
