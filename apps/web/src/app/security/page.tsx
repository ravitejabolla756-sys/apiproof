import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ShieldCheck, Lock, GitBranch, Terminal, CheckCircle2, ArrowRight } from "lucide-react";

export default function SecurityPage() {
  const securityPillars = [
    {
      icon: Lock,
      title: "Read-Only Code Inspection",
      tag: "IN-MEMORY PARSING",
      description: "MY OWL parses your TypeScript and JavaScript source files ephemerally in-memory using the TypeScript compiler API. We do not store, duplicate, or persistently retain your proprietary source code on our servers, and we never train machine learning models on your repositories.",
      points: [
        "In-memory ephemeral Abstract Syntax Tree (AST) parsing",
        "Zero persistent source code storage on disk",
        "No training on customer codebases",
        "Immediate buffer disposal post-analysis"
      ]
    },
    {
      icon: GitBranch,
      title: "Draft-Only Write Invariants",
      tag: "HUMAN OVERSIGHT",
      description: "MY OWL enforces strict write isolation. The platform cannot push directly to your default branch, cannot bypass branch protection rules, and cannot auto-merge code. All suggested migrations are delivered exclusively as GitHub Draft Pull Requests on isolated branches (apiproof/*).",
      points: [
        "Push access restricted to isolated apiproof/* branches",
        "Zero auto-merge capability or permissions",
        "Draft Pull Requests require human developer review and merge",
        "Full Git provenance and audit trails for every patch"
      ]
    },
    {
      icon: ShieldCheck,
      title: "Scoped GitHub App Permissions",
      tag: "LEAST PRIVILEGE",
      description: "Our official GitHub App requests only the minimum permissions necessary to detect API breaking changes and submit proposed fixes. We follow least-privilege principles across repository contents, issues, and pull requests.",
      points: [
        "Contents: Read-only access for AST symbol resolution",
        "Pull Requests: Write access solely for opening Draft PRs",
        "Webhooks: Push & release event notifications",
        "Revocable instantly through your GitHub organization settings"
      ]
    },
    {
      icon: Terminal,
      title: "4-Gate Verification Boundaries",
      tag: "COMPILER SAFETY",
      description: "No code diff is ever submitted without passing four deterministic verification gates. If a proposed migration fails compiler checks or diagnostic validations, the PR is withheld from submission.",
      points: [
        "Gate 1: Syntactic Validity parse verification",
        "Gate 2: TypeScript compiler diagnostic check",
        "Gate 3: Call-site boundary constraint verification",
        "Gate 4: Isolated test suite dry-run runner"
      ]
    }
  ];

  const invariantMatrix = [
    {
      operation: "Source Code Inspection",
      capability: "In-memory AST parsing only",
      status: "Allowed (Ephemeral)",
      detail: "Code is read into memory buffers, parsed into AST nodes, and immediately freed."
    },
    {
      operation: "Direct Commit to Main",
      capability: "Strictly blocked",
      status: "Forbidden",
      detail: "MY OWL has no permissions to write to default or protected branches."
    },
    {
      operation: "Auto-Merging Pull Requests",
      capability: "Strictly blocked",
      status: "Forbidden",
      detail: "No code is ever merged automatically; all draft PRs require human approval."
    },
    {
      operation: "Branch Write Scope",
      capability: "apiproof/* isolated prefix only",
      status: "Restricted",
      detail: "Branch creations are programmatically restricted to isolated migration branches."
    },
    {
      operation: "Data at Rest",
      capability: "Metadata & symbol diffs only",
      status: "Encrypted",
      detail: "Only finding IDs, symbol signatures, and audit logs are retained in encrypted storage."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <Lock className="w-3.5 h-3.5 text-slate-700" />
            <span>SECURITY ARCHITECTURE</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Engineered with Strict Security Invariants
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            How MY OWL protects your source code, isolates write boundaries, and guarantees zero auto-merge execution.
          </p>
        </div>

        {/* 4 PILLARS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {securityPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-[28px] bg-[#EFF1F5] p-7 md:p-8 flex flex-col justify-between border border-black/[0.04] space-y-6 shadow-xs"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#001033] shadow-xs border border-black/[0.06]">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase bg-black/[0.04] px-2.5 py-1 rounded-full">
                      {pillar.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-2xl font-normal text-[#000E29]">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-black/[0.06] space-y-2">
                  {pillar.points.map((pt) => (
                    <div key={pt} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* INVARIANT TABLE */}
        <div className="rounded-[28px] bg-[#EFF1F5] p-6 sm:p-8 border border-black/[0.04] space-y-6 shadow-xs">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono font-semibold tracking-wider text-slate-500 uppercase">
              OPERATIONAL BOUNDARIES
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#000E29] font-normal">
              Security Invariant Matrix
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Deterministic boundaries enforced by GitHub App scopes and application logic.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-slate-500 font-mono text-[11px] uppercase">
                  <th className="py-3 px-3">Operation</th>
                  <th className="py-3 px-3">MY OWL Capability</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Enforcement Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-slate-700">
                {invariantMatrix.map((row) => (
                  <tr key={row.operation} className="hover:bg-white/40 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-[#000E29]">{row.operation}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-800">{row.capability}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        row.status === "Forbidden"
                          ? "bg-rose-100 text-rose-800"
                          : row.status.startsWith("Allowed")
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Security-first breaking change detection.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Protect your production code with verifiable read-only safety guarantees.
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
