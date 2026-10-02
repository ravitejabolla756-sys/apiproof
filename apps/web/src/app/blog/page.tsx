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
      title: "Why migration baselines require exact commit SHAs",
      readTime: "5 min read",
      summary: "How Git branch head drift creates patch corruption, and why pinning an immutable 40-character baseline commit SHA prevents divergent proposals.",
      codeSnippet: "HEAD_SHA = 7a3f89d1b0924e3c881023a9d20c56b7104e6721"
    },
    {
      category: "DETERMINISTIC CODEGEN",
      title: "Why deterministic patching matters over AI guessing",
      readTime: "6 min read",
      summary: "Why prompting generic LLMs to rewrite entire source files causes formatting churn and hallucinated bugs, compared to bounded, rule-driven AST transformations that preserve your project's indentation and comments.",
      codeSnippet: "DeterministicPatchGenerator: minimal unified diff (+1, -1)"
    },
    {
      category: "VERIFICATION HARNESS",
      title: "How MY OWL verifies migrations before creating a Draft PR",
      readTime: "8 min read",
      summary: "A detailed breakdown of our 4-gate safety harness: AST syntax validity parsing, TypeScript compiler diagnostics, call-site boundary constraints, and dry-run test execution.",
      codeSnippet: "GateHarness: [SyntaxValid, TscDiagnosticCheck, ScopeBoundary, TestRunner]"
    },
    {
      category: "SECURITY INVARIANTS",
      title: "Why safe automation stops at the Draft PR instead of auto-merging",
      readTime: "5 min read",
      summary: "Examining our foundational architectural invariant: developer agency must remain sovereign. Why automated tools should never merge code or push directly to default branches.",
      codeSnippet: "ControlledWrite: { branch: 'apiproof/*', draft: true, autoMerge: false }"
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
            Deep-dives into Abstract Syntax Tree analysis, deterministic patch generation, compiler verification gates, and Git write contracts.
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
