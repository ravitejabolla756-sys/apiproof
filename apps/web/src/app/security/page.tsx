import React from "react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import {
  Lock,
  GitBranch,
  CheckCircle2,
  Key,
  FileCheck
} from "lucide-react";

export default function SecurityPage() {
  const securityArchitecture = [
    {
      icon: Key,
      title: "GitHub App Authentication & Scopes",
      tag: "LEAST PRIVILEGE",
      description: "MY OWL connects via an official GitHub App rather than personal access tokens. The detection-only beta is restricted to read repository contents and metadata for compatibility analysis.",
      points: [
        "Repository Contents: Read-only access for ephemeral AST symbol parsing",
        "Pull Requests: No access in the current detection-only beta",
        "Zero default branch (main/master) write permissions",
        "Revocable instantly through GitHub Organization Settings"
      ]
    },
    {
      icon: Lock,
      title: "Installation State Binding & Webhook HMAC",
      tag: "TAMPER RESISTANT",
      description: "Installation flows generate single-use, cryptographically signed state tokens with 15-minute expiration to prevent cross-site request forgery and installation hijacking.",
      points: [
        "HMAC-SHA256 state signature bound to user and workspace ID",
        "Incoming GitHub webhook signature verification (X-Hub-Signature-256)",
        "Replay attack prevention via unique webhook delivery IDs",
        "Zero exposure of GitHub App private keys to the client"
      ]
    },
    {
      icon: GitBranch,
      title: "Detection-Only Safety Contract",
      tag: "READ-ONLY BOUNDARY",
      description: "The current beta uses read-only GitHub access. Migration writes remain disabled, and direct commits to default branches are not attempted.",
      points: [
        "No branch, commit, check, patch, or pull-request operation is available",
        "Repository access is limited to the selected repositories",
        "Migration proposal routes fail closed unless separately authorized in a future release",
        "Teams choose and apply remediation in their own workflow"
      ]
    },
    {
      icon: FileCheck,
      title: "Baseline Integrity & Divergence Protection",
      tag: "STATE GUARANTEE",
      description: "Scans record the exact 40-character Git commit SHA of the target branch so compatibility evidence remains tied to the repository state that was analyzed.",
      points: [
        "Immutable baseline commit SHA pinned during AST analysis",
        "Compatibility evidence includes the analyzed repository snapshot",
        "A later rescan produces a new evidence record instead of modifying the repository",
        "Reviewed rule provenance remains bound to the resulting proof"
      ]
    }
  ];

  const invariantMatrix = [
    {
      operation: "Source Code Inspection",
      capability: "Read-only AST traversal",
      status: "Implemented",
      detail: "Code is read into memory buffers, parsed into AST nodes by ts-morph, and analyzed for symbol reachability."
    },
    {
      operation: "Default Branch (main/master) Commits",
      capability: "Strictly forbidden",
      status: "Blocked",
      detail: "MY OWL has no permissions to write directly to default branches and the current beta performs no repository writes."
    },
    {
      operation: "Auto-Merging Pull Requests",
      capability: "Strictly forbidden",
      status: "Blocked",
      detail: "No auto-merge capability or permissions exist. The current beta does not create proposals or pull requests."
    },
    {
      operation: "Repository Writes",
      capability: "Unavailable in current beta",
      status: "Blocked",
      detail: "Branch creation, patch application, checks, and pull requests are not available in the detection-only beta."
    },
    {
      operation: "Compatibility Evidence Scope",
      capability: "Exact detected usage location",
      status: "Implemented",
      detail: "Findings retain the affected file, line, provider rule, and reason codes needed for human remediation."
    },
    {
      operation: "Human Remediation",
      capability: "Customer-controlled",
      status: "Implemented",
      detail: "MY OWL supplies evidence-linked compatibility findings; teams apply and verify their own changes."
    },
    {
      operation: "Data Persistence",
      capability: "Metadata, findings & plans only",
      status: "Implemented",
      detail: "Database stores repository metadata, baseline SHAs, finding snippets, and verification reports."
    },
    {
      operation: "Self-Hosted Runners / Private VPC",
      capability: "Execution in customer perimeter",
      status: "Planned",
      detail: "Architecture supports runner decoupling; dedicated self-hosted test execution is on the roadmap."
    },
    {
      operation: "Enterprise SSO / SAML",
      capability: "Corporate identity integration",
      status: "Planned",
      detail: "Currently supports GitHub OAuth session auth; SAML/Okta integration is on the roadmap."
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
            <span>SECURITY ARCHITECTURE &amp; INVARIANTS</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            Security Built on Verifiable Boundaries
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            MY OWL is engineered for security-conscious development teams. We document our actual security controls, write contracts, and architectural invariants truthfully.
          </p>
        </div>

        {/* 4 CORE SECURITY ARCHITECTURE PILLARS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {securityArchitecture.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-3xl bg-white border border-slate-200/80 p-7 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#001033] border border-slate-200">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-600 uppercase bg-slate-100 px-2.5 py-1 rounded-full">
                      {pillar.tag}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#000E29]">
                      {pillar.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-sans">
                      {pillar.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2 font-mono text-xs text-slate-700">
                  {pillar.points.map((pt) => (
                    <div key={pt} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* SECURITY INVARIANT MATRIX */}
        <div className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono font-semibold tracking-wider text-[#004EE8] uppercase">
              OPERATIONAL INVARIANTS
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#000E29] font-normal">
              Security Invariant Matrix
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-sans">
              Strict detection boundaries enforced by our read-only GitHub App permissions and platform architecture.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                  <th className="py-3 px-3">Operation / Capability</th>
                  <th className="py-3 px-3">Enforcement</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Implementation Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {invariantMatrix.map((row) => (
                  <tr key={row.operation} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-[#000E29]">{row.operation}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-800 text-[11px]">{row.capability}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        row.status === "Blocked"
                          ? "bg-rose-100 text-rose-800"
                          : row.status === "Enforced" || row.status === "Implemented"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 leading-relaxed text-xs">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* HONEST DATA HANDLING SECTION */}
        <div className="rounded-3xl bg-[#000E29] text-white p-8 sm:p-10 space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
              DATA HANDLING &amp; SOURCE INTEGRITY
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal">
              What We Store and What We Discard
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              We believe in radical transparency about data boundaries. We do not make vague marketing claims; here is exactly what our database holds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10 text-xs font-mono">
            <div className="space-y-3 p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="text-emerald-400 font-bold uppercase text-[11px]">WHAT IS STORED IN DATABASE</div>
              <ul className="space-y-2 text-slate-300 font-sans text-xs leading-relaxed">
                <li>• Repository identity (GitHub ID, full name, default branch name)</li>
                <li>• Baseline commit SHA (40-char hex string)</li>
                <li>• Finding metadata: file path, line number, AST symbol, and minimal source snippet around the affected call site</li>
                <li>• Compatibility Proof, reason codes, and reviewed source provenance</li>
                <li>• Reviewed source provenance and compatibility-proof metadata</li>
                <li>• Audit logs of scan events and evidence retrieval</li>
              </ul>
            </div>

            <div className="space-y-3 p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="text-cyan-400 font-bold uppercase text-[11px]">WHAT IS NEVER STORED</div>
              <ul className="space-y-2 text-slate-300 font-sans text-xs leading-relaxed">
                <li>• Full repository source trees or unimpacted files</li>
                <li>• Customer environment variables or .env secrets</li>
                <li>• Customer database passwords or production API keys</li>
                <li>• Private keys (stored in encrypted server environment only)</li>
                <li>• We do not train machine learning models on customer code</li>
              </ul>
            </div>
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
