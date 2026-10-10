import React from "react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Terminal } from "lucide-react";

export default function BlogPage() {
  const articles = [
    {
      category: "COMPILER INTERNALS",
      title: "Why package.json presence is not proof of affected usage",
      readTime: "6 min read",
      summary: "Exploring why naive dependency manifest scanners produce 90% false positive alert fatigue, and how parsing call expressions into an Abstract Syntax Tree distinguishes merely installed libraries from active breakages.",
      codeSnippet: "package.json presence !== reachable CallExpression"
    },
    {
      category: "AST MATCHING",
      title: "How AST symbol tracing identifies affected call sites",
      readTime: "7 min read",
      summary: "A technical walkthrough of import alias resolution, property access inspection, and destructured parameter evaluation using ts-morph to pinpoint the exact line numbers needing migration.",
      codeSnippet: "ts.isCallExpression(node) && matchPropertyAssignment(node, 'coupon')"
    },
    {
      category: "STATE INTEGRITY",
      title: "Why compatibility evidence records exact commit SHAs",
      readTime: "5 min read",
      summary: "How immutable 40-character baseline commit SHAs keep compatibility evidence tied to the exact repository state a team reviews.",
      codeSnippet: "HEAD_SHA = 7a3f89d1b0924e3c881023a9d20c56b7104e6721"
    },
    {
      category: "REMEDIATION ROADMAP",
      title: "Why remediation remains a human decision in the beta",
      readTime: "6 min read",
      summary: "Why the current beta stops at evidence-linked findings: teams retain control of the remediation path while migration capabilities remain unavailable.",
      codeSnippet: "DetectionOnlyBeta: evidence -> human remediation"
    },
    {
      category: "COMPATIBILITY PROOF",
      title: "How MY OWL makes compatibility evidence reviewable",
      readTime: "8 min read",
      summary: "A detailed breakdown of reviewed rules, normalized usage evidence, source locations, and reason codes that support an engineering decision.",
      codeSnippet: "CompatibilityProof: [Rule, Evidence, ReasonCode, SourceLocation]"
    },
    {
      category: "SECURITY INVARIANTS",
      title: "Why the detection-only beta makes no repository writes",
      readTime: "5 min read",
      summary: "Examining our current beta boundary: developer agency remains sovereign because MY OWL does not create branches, patches, checks, or pull requests.",
      codeSnippet: "ReadOnlyBeta: { repositoryWrites: false }"
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <Terminal className="w-3.5 h-3.5 text-slate-700" />
            <span>ENGINEERING &amp; ARCHITECTURE NOTES</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Technical Writing
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Deep-dives into Abstract Syntax Tree analysis, compatibility evidence, provider rules, and read-only GitHub safety boundaries.
          </p>
        </div>

        {/* ARTICLES LIST */}
        <div className="space-y-6">
          {articles.map((art) => (
            <article
              key={art.title}
              className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 space-y-4 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
                <span className="text-[#004EE8] font-bold uppercase tracking-wider">
                  {art.category}
                </span>
                <span>{art.readTime}</span>
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-2xl text-[#000E29] font-normal leading-snug">
                  {art.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                  {art.summary}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 font-mono text-xs text-slate-700 flex items-center justify-between">
                <span className="text-slate-500 text-[11px] truncate max-w-md">
                  {art.codeSnippet}
                </span>
                <span className="text-[#004EE8] text-[11px] font-semibold shrink-0 ml-2">
                  Technical Note
                </span>
              </div>
            </article>
          ))}
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
