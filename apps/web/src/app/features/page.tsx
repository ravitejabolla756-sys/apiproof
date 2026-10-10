import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight } from "lucide-react";

export default function FeaturesPage() {
  const featureGroups = [
    {
      group: "ANALYSIS",
      tag: "COMPILER INTELLIGENCE",
      title: "AST-Based Codebase Analysis",
      summary: "Evaluates actual code reachability using TypeScript/JavaScript compiler AST parsing rather than superficial regex or package manifest version alarms.",
      features: [
        {
          name: "AST-Based Symbol Traversal",
          desc: "Parses TypeScript and JavaScript source files into an Abstract Syntax Tree (AST) via ts-morph, inspecting AST nodes with full type awareness."
        },
        {
          name: "Detected vs. Affected Classification",
          desc: "Separates passive package presence from active code invocation. Only call sites that actively pass changed parameters or reference deprecated symbols are flagged as Affected."
        },
        {
          name: "Import & Call-Site Tracing",
          desc: "Resolves named imports, default imports, re-exports, and local variable aliases back to their upstream SDK origin to eliminate false matches."
        },
        {
          name: "Destructured Property & Argument Inspection",
          desc: "Drills into ObjectLiteralExpressions passed to API methods, verifying whether specific properties or values match breaking change criteria."
        }
      ]
    },
    {
      group: "ROADMAP",
      tag: "NOT IN THE CURRENT BETA",
      title: "Migration Assistance (Planned)",
      summary: "Migration planning, patch generation, and pull request creation are deliberately unavailable in the detection-only beta.",
      features: [
        {
          name: "Evidence Before Automation",
          desc: "The beta gives engineers the reviewed rule, exact usage, and source evidence needed to decide a migration themselves."
        },
        {
          name: "No Repository Writes",
          desc: "MY OWL does not create patches, branches, commits, or pull requests in the current beta."
        },
        {
          name: "Future Capability Boundary",
          desc: "Migration assistance will require a separate, explicitly authorized release and write-permission review."
        },
        {
          name: "Human-Owned Changes",
          desc: "Your team remains responsible for choosing, testing, and applying any code change."
        }
      ]
    },
    {
      group: "PROOF",
      tag: "REVIEWED COMPATIBILITY",
      title: "Evidence-Linked Compatibility Proof",
      summary: "Every finding links provider change facts to the matched repository usage and its reason codes.",
      features: [
        {
          name: "Official Source Provenance",
          desc: "Reviewed rules retain official-source provenance and evidence fingerprints."
        },
        {
          name: "Exact Usage Classification",
          desc: "Static matching distinguishes affected, not-affected, and needs-review usage without guessing dynamic values."
        },
        {
          name: "Source Location Evidence",
          desc: "Findings retain the exact repository file and line when the analyzer can establish it."
        },
        {
          name: "Human Review Boundary",
          desc: "Compatibility findings inform a human decision; they do not change a repository."
        },
        {
          name: "Planned Migration Features",
          desc: "Patch generation and execution-bound verification are retained for future authorized development, not exposed by this beta."
        }
      ]
    },
    {
      group: "GITHUB",
      tag: "READ-ONLY BETA",
      title: "GitHub App Safety Boundaries",
      summary: "Connects through an authorized read-only GitHub App for repository scanning and compatibility evidence.",
      features: [
        {
          name: "Read-Only Repository Access",
          desc: "The beta reads approved repository contents for scanning and does not write branches, commits, checks, or pull requests."
        },
        {
          name: "No Pull Request Capability",
          desc: "Draft Pull Request generation is unavailable until a future authorized release with separately reviewed write permissions."
        },
        {
          name: "No Auto-Merge Capability",
          desc: "The beta cannot merge or modify customer code. Human engineers retain complete control of repository changes."
        },
        {
          name: "Approved Repository Scope",
          desc: "Workspace authorization and repository allowlists keep scans scoped to repositories your workspace has connected."
        }
      ]
    },
    {
      group: "OPERATIONS",
      tag: "AUDIT & LIFECYCLE",
      title: "Workspace Isolation & Auditability",
      summary: "Multi-tenant workspace isolation, persistent finding lifecycles, and tamper-evident activity logging for complete team visibility.",
      features: [
        {
          name: "Workspace Multi-Tenancy",
          desc: "Strict tenant isolation ensures repository configurations, scan results, and compatibility findings are isolated to authorized workspace members."
        },
        {
          name: "Finding Lifecycle Management",
          desc: "Tracks reviewed compatibility findings and scan outcomes across re-scans."
        },
        {
          name: "Idempotent Scan & Worker Queues",
          desc: "Background scan workers process jobs with unique idempotency keys, preventing duplicate findings and concurrent write collisions."
        },
        {
          name: "Granular Activity Audit Logs",
          desc: "Records scan initiation and finding detection for workspace auditability."
        }
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
            <span>VERIFIED PLATFORM CAPABILITIES</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Developer Infrastructure for Breaking API Changes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            The current beta is grounded in compiler truth, reviewed provider evidence, and read-only compatibility detection.
          </p>
        </div>

        {/* 5 FEATURE GROUPS */}
        <div className="space-y-12">
          {featureGroups.map((group) => (
            <section
              key={group.group}
              className="rounded-3xl bg-white border border-slate-200/80 p-8 sm:p-10 space-y-8 shadow-xs"
            >
              {/* Group Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-6 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#004EE8]">
                    <span>{group.group}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-500">{group.tag}</span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl text-[#000E29] font-normal">
                    {group.title}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-mono sm:max-w-xs text-left sm:text-right">
                  {group.summary}
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {group.features.map((feat) => (
                  <div
                    key={feat.name}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 hover:border-slate-200 transition-colors"
                  >
                    <h3 className="font-semibold text-sm text-[#000E29] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#004EE8] shrink-0" />
                      {feat.name}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA BOTTOM */}
        <div className="rounded-3xl bg-[#000E29] text-white p-8 sm:p-12 text-center space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-normal max-w-xl mx-auto">
            Ready to protect your repositories from silent API breakage?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Install the GitHub App in under a minute. Connect repositories, run an AST scan, and inspect evidence-linked compatibility findings.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
