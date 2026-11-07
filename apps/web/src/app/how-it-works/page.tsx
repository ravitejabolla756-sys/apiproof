import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock
} from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    {
      step: "01",
      name: "CONNECT",
      title: "Install GitHub App & Authorize Repositories",
      summary: "Install the official MY OWL GitHub App and select which repositories to protect. The installation establishes an isolated workspace with cryptographic state binding.",
      input: "GitHub Organization or User Account credentials with repository administration.",
      processing: "MY OWL generates a cryptographically signed HMAC-SHA256 state token bound to the active user session and workspace ID (15-minute TTL). The GitHub App webhook listener registers events for push and release triggers.",
      output: "Authorized repository record in MY OWL database with scoped least-privilege installation credentials.",
      failureCondition: "User denies permissions or state token HMAC validation expires / fails → Connection aborted.",
      artifact: `// GitHub App Installation State Token Binding
{
  "installationId": "gh_inst_4829104",
  "workspaceId": "ws_alpha_prod",
  "requestedScopes": ["contents:read", "pull_requests:write"],
  "stateSignature": "hmac_sha256(payload, VERIFIER_SECRET)",
  "status": "AUTHORIZED"
}`
    },
    {
      step: "02",
      name: "OBSERVE",
      title: "Establish Immutable Analysis Snapshot",
      summary: "MY OWL reads your repository structure, discovers dependency manifests, and pins the exact 40-character Git commit SHA of your default branch as the baseline.",
      input: "Target repository default branch (e.g., main or master).",
      processing: "Fetches repository file tree via Git transport. Resolves package manifests (package.json, lockfiles) and locks the exact HEAD commit SHA as the immutable analysis baseline.",
      output: "Repository baseline snapshot with baseline commit SHA and discovered dependency catalog.",
      failureCondition: "Repository is empty, contains no supported manifest, or network transport fails → Scan exits cleanly with 'unsupported' status.",
      artifact: `// Baseline Snapshot Record
{
  "repository": "acme/billing-service",
  "defaultBranch": "main",
  "baselineSha": "7a3f89d1b0924e3c881023a9d20c56b7104e6721",
  "discoveredManifests": ["package.json"],
  "treeSize": 142
}`
    },
    {
      step: "03",
      name: "DETECT",
      title: "Match Upstream Breaking Change Rules",
      summary: "Our changelog ingestion pipeline continuously monitors vendor SDK releases, turning deprecation announcements into machine-readable AST change rules.",
      input: "Discovered package dependencies vs. verified upstream vendor catalog (Stripe, Twilio).",
      processing: "Compares installed dependency version constraints against rule trigger ranges (e.g. stripe-node upgrade from v17.x to v18.0.0). Identifies candidate breaking changes.",
      output: "List of candidate change IDs to inspect for reachability in the target codebase.",
      failureCondition: "No breaking change rules match installed package versions → Scan completes with 0 findings.",
      artifact: `// Candidate Breaking Change Rule
{
  "ruleId": "stripe-v18-sub-coupon",
  "provider": "stripe",
  "targetPackage": "stripe",
  "deprecatedParameter": "coupon",
  "breakingInVersion": "18.0.0",
  "severity": "breaking",
  "status": "CANDIDATE_MATCH"
}`
    },
    {
      step: "04",
      name: "TRACE",
      title: "Pinpoint Reachable Call Sites via AST Analysis",
      summary: "Instead of simplistic regex or package.json alerts, MY OWL parses TypeScript and JavaScript files into a typed Abstract Syntax Tree (AST) using ts-morph to find active call sites.",
      input: "TypeScript/JavaScript source files in target repository.",
      processing: "Resolves import declarations, aliased identifiers, and custom client wrappers. Evaluates CallExpressions and PropertyAccessExpressions to determine whether arguments actively reference the breaking parameter.",
      output: "Confirmed Finding records with exact file paths, line numbers, symbols, and code snippets. Safe/untouched invocations are filtered out.",
      failureCondition: "Symbol exists in dependency but is never invoked or never passes deprecated parameters → Classified as 'Detected' but 'Unaffected'. Zero noise.",
      artifact: `// Confirmed Reachable Finding Record
{
  "findingId": "find_8f21c904",
  "file": "src/billing.ts",
  "line": 42,
  "symbol": "stripe.subscriptions.create",
  "matchedProperty": "coupon",
  "reachability": "CONFIRMED_AFFECTED",
  "excludedSafeCalls": 26
}`
    },
    {
      step: "05",
      name: "PLAN",
      title: "Synthesize Context-Bound Migration Plan",
      summary: "The planning engine maps the confirmed finding to a deterministic transformation strategy, specifying the exact syntax tree modification.",
      input: "Confirmed finding + matching migration rule + target source context.",
      processing: "Constructs a MigrationPlan defining the target AST node (PropertyAssignment), the replacement expression (discounts array), and bounding constraints.",
      output: "Structured, deterministic MigrationPlan JSON artifact.",
      failureCondition: "Call-site structure contains ambiguous dynamic expressions that cannot be safely transformed deterministically → Flagged for manual review.",
      artifact: `// Structured Migration Plan
{
  "planId": "plan_9f82d1c0",
  "changeId": "stripe-v18-sub-coupon",
  "targetFile": "src/billing.ts",
  "nodeType": "PropertyAssignment",
  "before": "coupon: promoCouponId",
  "after": "discounts: [{ coupon: promoCouponId }]"
}`
    },
    {
      step: "06",
      name: "PATCH",
      title: "Generate Deterministic Source Patch",
      summary: "Applies the migration plan against the exact source text, preserving original indentation, quotation style, and developer comments.",
      input: "Baseline source snapshot + MigrationPlan.",
      processing: "Executes minimal AST rewrite. Computes unified diff and calculates a canonical SHA256 patch digest of the resulting code.",
      output: "Unified patch diff and canonical patch digest bound to the baseline commit SHA.",
      failureCondition: "Baseline source file has changed or digest does not match expected canonical representation → Patch generation halted.",
      artifact: `// Unified Source Diff
@@ -40,6 +40,6 @@ export async function createSubscription(customerId: string) {
   return await stripe.subscriptions.create({
     customer: customerId,
-    coupon: promoCouponId,
+    discounts: [{ coupon: promoCouponId }],
     items: [{ price: priceId }],
   });`
    },
    {
      step: "07",
      name: "VERIFY",
      title: "Run 4-Gate Pre-Flight Verification Harness",
      summary: "Before any Git branch or pull request is created, the candidate patch must pass four deterministic verification gates.",
      input: "Patched codebase snapshot in isolated execution sandbox.",
      processing: "Gate 1: AST Syntax Validity parse.\nGate 2: TypeScript compiler diagnostic check (tsc --noEmit).\nGate 3: Call-site boundary constraint (verifies only allowed files & lines modified).\nGate 4: Dry-run execution of repository test suite.",
      output: "Cryptographically signed Verification Evidence artifact binding baseline SHA, change ID, and patch digest.",
      failureCondition: "Any compiler error, diagnostic failure, patch scope violation, or test failure → Process terminates. No PR is created.",
      artifact: `// Cryptographically Signed Verification Evidence
{
  "proofLevel": "CONTRACT_VERIFIED",
  "syntaxValid": true,
  "typecheckPassed": true,
  "scopeValid": true,
  "testsPassed": true,
  "evidenceDigest": "d8a9c41f7e02b489e21190bc74a3..."
}`
    },
    {
      step: "08",
      name: "PROPOSE",
      title: "Push Isolated Branch & Open GitHub Draft PR",
      summary: "MY OWL enforces strict write isolation. It creates a dedicated branch with an explicit prefix (apiproof/*) and submits a GitHub Draft PR marked draft: true.",
      input: "Verified patch artifact + Signed Verification Evidence.",
      processing: "Validates ControlledWriteRequest against write contract. Checks default branch HEAD SHA for divergence. Pushes single commit to apiproof/<change-id> and opens Draft PR via GitHub App API.",
      output: "GitHub Draft Pull Request containing side-by-side diffs, migration rationale, and verification reports.",
      failureCondition: "Default branch HEAD has moved since the scan was performed (REPOSITORY_HEAD_DIVERGED) → Write rejected. Fresh scan required.",
      artifact: `// GitHub App Controlled Write Result
{
  "action": "DRAFT_PR_OPENED",
  "prNumber": 142,
  "branch": "apiproof/stripe-v18-update",
  "baseBranch": "main",
  "draft": true,
  "autoMerge": false
}`
    },
    {
      step: "09",
      name: "REVIEW",
      title: "Human Developer Review & Merge",
      summary: "Your engineering team retains total sovereignty. Engineers review the Draft PR, inspect automated test runs, and decide when to merge.",
      input: "GitHub Draft PR #142 on your repository.",
      processing: "Your team conducts normal code review, runs your existing CI/CD checks, and merges the PR when ready.",
      output: "Safely migrated production code with complete audit history and zero silent failures.",
      failureCondition: "Engineer closes or requests changes on PR → PR closed. MY OWL records resolution status in audit log.",
      artifact: `// Developer Sovereignty Boundary
{
  "humanSignOffRequired": true,
  "autoMergePermissions": "NONE",
  "defaultBranchProtection": "PRESERVED",
  "status": "AWAITING_TEAM_REVIEW"
}`
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16 outline-none">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>DETERMINISTIC PIPELINE SPECIFICATION</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            From API Change to Verified Draft PR
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            A step-by-step technical breakdown of how MY OWL detects upstream breaking changes, traces affected call sites, verifies migrations, and stops at a Draft PR.
          </p>
        </div>

        {/* INVARIANTS CALLOUT BAR */}
        <div className="rounded-2xl bg-[#000E29] text-white p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono border border-white/10">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Read-Only Default Branch</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Zero Auto-Merge Policy</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
            <span>4-Gate Compiler Verification</span>
          </div>
        </div>

        {/* 9 DETAILED STEPS */}
        <div className="space-y-10">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs hover:border-slate-300 transition-colors"
            >
              {/* Step Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-white bg-[#000E29] px-2.5 py-1 rounded-md">
                    {item.step}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#004EE8] uppercase tracking-wider">
                    {item.name}
                  </span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#000E29] font-normal">
                    {item.title}
                  </h2>
                </div>
              </div>

              {/* Summary */}
              <p className="text-sm text-slate-700 leading-relaxed font-sans">
                {item.summary}
              </p>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">INPUT</span>
                  <p className="text-slate-800 font-sans text-xs leading-relaxed">{item.input}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">PROCESSING</span>
                  <p className="text-slate-800 font-sans text-xs leading-relaxed">{item.processing}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                  <span className="text-emerald-800 font-bold uppercase text-[10px] block">OUTPUT</span>
                  <p className="text-emerald-950 font-sans text-xs leading-relaxed">{item.output}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 space-y-1">
                  <span className="text-rose-800 font-bold uppercase text-[10px] block">FAILURE CONDITION (FAIL CLOSED)</span>
                  <p className="text-rose-950 font-sans text-xs leading-relaxed">{item.failureCondition}</p>
                </div>
              </div>

              {/* Concrete Artifact / Code Block */}
              <div
                role="region"
                aria-label={`${item.name} system artifact`}
                tabIndex={0}
                className="rounded-xl bg-[#000E29] text-white p-4 font-mono text-xs overflow-x-auto space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2"
              >
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block">
                  SYSTEM ARTIFACT: {item.name}
                </span>
                <pre className="text-slate-200 text-[11px] leading-relaxed pt-1">
                  {item.artifact}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM CALL TO ACTION */}
        <div className="text-center pt-8 space-y-4">
          <Link
            href="/login"
            className="btn-lime inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <span>Connect GitHub Free</span>
            <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
          </Link>
          <div className="text-xs font-mono text-slate-500">
            Read-only observation · Isolated branches · Human review boundary
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
