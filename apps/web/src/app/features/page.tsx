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
      group: "MIGRATION",
      tag: "DETERMINISTIC CODEGEN",
      title: "Controlled Patch Generation",
      summary: "Synthesizes minimal, context-bound code transformations derived from machine-readable migration rules against the exact baseline commit SHA.",
      features: [
        {
          name: "Deterministic Migration Planning",
          desc: "Generates structured MigrationPlan artifacts targeting specific AST nodes without asking an LLM to hallucinate arbitrary file rewrites."
        },
        {
          name: "Minimal Patch Diffing",
          desc: "Modifies only the necessary lines and tokens. Avoids noisy full-file formatting or re-ordering of unrelated variables."
        },
        {
          name: "Exact Source Snapshot Handling",
          desc: "Binds patches to the exact 40-character Git commit SHA of the default branch, preventing application against out-of-date source states."
        },
        {
          name: "Whitespace & Code Style Preservation",
          desc: "Maintains your project's single/double quotes, semicolon rules, tab/space indentation, and developer comments."
        }
      ]
    },
    {
      group: "VERIFICATION",
      tag: "ZERO-DEFECT HARNESS",
      title: "4-Gate Compiler Verification",
      summary: "Before any proposal is submitted to GitHub, every candidate migration must pass four deterministic pre-flight safety gates in an isolated runner.",
      features: [
        {
          name: "Gate 1: AST Syntax Validity",
          desc: "Verifies that the patched file parses cleanly into a valid syntax tree with zero compiler parsing errors."
        },
        {
          name: "Gate 2: TypeScript Compiler Diagnostics",
          desc: "Executes `tsc --noEmit` validation against the patched code to ensure zero new type errors or broken interface contracts."
        },
        {
          name: "Gate 3: Call-Site Scope & Boundary Check",
          desc: "Strictly enforces that modifications are confined to the intended target file and lines, rejecting forbidden files or repo-level scripts."
        },
        {
          name: "Gate 4: Dry-Run Test Execution",
          desc: "Executes your repository's automated test suite against the candidate patch to confirm that existing application behaviors remain intact."
        },
        {
          name: "Execution-Bound Verification Evidence",
          desc: "Generates a cryptographically signed verification evidence artifact that binds the repository ID, baseline SHA, change ID, and patch digest."
        }
      ]
    },
    {
      group: "GITHUB",
      tag: "WRITE CONTRACT",
      title: "GitHub App Safety Boundaries",
      summary: "Connects securely through an authorized GitHub App with strictly bounded permissions, isolated branches, and absolute zero auto-merge.",
      features: [
        {
          name: "Isolated Migration Branches",
          desc: "Writes proposals exclusively to dedicated branches with canonical prefixes (`apiproof/*` or `myowl/*`), never touching main."
        },
        {
          name: "GitHub Draft Pull Requests",
          desc: "Submits proposals as GitHub Draft PRs (`draft: true`) accompanied by verification reports, side-by-side diffs, and upstream change rationale."
        },
        {
          name: "Zero Auto-Merge Policy",
          desc: "MY OWL has zero auto-merge capability and zero auto-merge permissions. Human engineers retain total agency to review, test, and merge."
        },
        {
          name: "Repository Divergence Protection",
          desc: "If your default branch HEAD has moved since the scan was performed, MY OWL stops immediately and requires a fresh scan before proposing a patch."
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
          desc: "Strict tenant isolation ensures repository configurations, scan results, and migration proposals are isolated to authorized workspace members."
        },
        {
          name: "Finding Lifecycle Management",
          desc: "Tracks breaking change findings across states (`open`, `planned`, `proposed`, `resolved`), maintaining history across re-scans."
        },
        {
          name: "Idempotent Scan & Worker Queues",
          desc: "Background scan workers process jobs with unique idempotency keys, preventing duplicate findings and concurrent write collisions."
        },
        {
          name: "Granular Activity Audit Logs",
          desc: "Records every scan initiation, finding detection, migration synthesis, verification run, and GitHub proposal for compliance tracking."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16 outline-none">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>VERIFIED PLATFORM CAPABILITIES</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Developer Infrastructure for Breaking API Changes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Everything implemented in MY OWL is grounded in compiler truth, deterministic patch generation, and strict pre-flight verification.
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
            Install the GitHub App in under a minute. Connect repositories, run an AST scan, and inspect verified migration proposals.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime min-h-11 inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
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
