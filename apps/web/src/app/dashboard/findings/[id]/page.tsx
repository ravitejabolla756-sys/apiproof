"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { getPullRequestStateLabel } from "@/lib/compatibility-map-labels";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface FindingDetail {
  id: string;
  provider: string;
  change_id: string;
  title: string;
  description: string;
  severity: string;
  confidence: string;
  file_path: string;
  line_number: number;
  symbol: string;
  reason: string;
  source_snippet: string | null;
  status: string;
  created_at: string;
  repo_name: string;
  repo_full_name: string;
  repo_owner: string;
  default_branch: string;
  evidence: Array<{ id: string; kind: string; label: string }>;
  reasonCodes: string[];
}

interface MigrationDetail {
  id: string;
  plan_id: string;
  status: string;
  patch_diff: string;
  patch_digest: string;
  pr_number?: number;
  pr_url?: string;
  branch_name?: string;
  target_branch?: string;
  pr_state?: string;
  lifecycle_state?: 'Migration Planned' | 'Verification Pending' | 'Verification Passed' | 'Verification Failed' | 'Draft PR Created' | 'Pull Request Open' | 'Pull Request Closed' | 'Pull Request Merged' | 'Pull Request State Unavailable';
}

export default function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [migration, setMigration] = useState<MigrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function loadFinding() {
    try {
      const res = await fetch(`/api/findings/${id}`);
      if (res.ok) {
        const json = await res.json();
        setFinding(json.finding);
        setMigration(json.migration);
      }
    } catch (err) {
      console.error("Failed to load finding:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinding();
  }, [id]);

  async function handleGeneratePlan() {
    if (!finding) return;
    setPlanning(true);
    setMessage(null);

    try {
      const res = await fetch("/api/migrations/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Plan generation failed.");
      }

      setMessage({ text: "Deterministic migration plan generated. Verification is pending until the proposal workflow executes it." });
      await loadFinding();
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setPlanning(false);
    }
  }

  async function handleProposePR() {
    if (!migration) return;
    setProposing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/migrations/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ migrationId: migration.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Draft proposal failed.");
      }

      setMessage({ text: `${getPullRequestStateLabel(data.proposal.state)} #${data.proposal.number} on branch ${data.proposal.branchName}.` });
      await loadFinding();
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setProposing(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-[#686868] font-sans">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
        <span>Loading AST finding workbench...</span>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-4 font-sans text-xs">
        <Link href="/dashboard/findings" className="text-zinc-500 hover:text-black flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Findings
        </Link>
        <div className="p-8 text-center bg-white border border-[#E8E8E5] rounded-[24px]">
          Finding not found or access denied.
        </div>
      </div>
    );
  }

  const currentStep = migration?.pr_number ? 3 : migration ? 2 : 1;

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* BACK NAVIGATION */}
      <div>
        <Link
          href="/dashboard/findings"
          className="inline-flex items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Findings
        </Link>
      </div>

      {/* LIGHT CANVAS HEADER BAND */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold uppercase">
                {finding.provider}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
                {finding.title}
              </h1>
            </div>
            <p className="text-xs text-[#686868] max-w-2xl leading-relaxed">
              {finding.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill status="affected" label={finding.severity.toUpperCase()} />
            {migration && (
              <StatusPill
                status={migration.lifecycle_state === "Verification Passed" || migration.lifecycle_state === "Pull Request Merged" ? "verified" : migration.lifecycle_state === "Verification Failed" || migration.lifecycle_state === "Pull Request Closed" ? "warning" : migration.lifecycle_state === "Draft PR Created" || migration.lifecycle_state === "Pull Request Open" ? "pr_created" : migration.lifecycle_state === "Pull Request State Unavailable" ? "neutral" : "detected"}
                label={migration.lifecycle_state || "Migration Planned"}
              />
            )}
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.error
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-emerald-50 text-emerald-900 border border-emerald-200"
            }`}
          >
            {message.error ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* FINDING LIFECYCLE STEPPER */}
        <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686868]">
            Lifecycle Progression
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Step 1: Detected */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep >= 1
                ? 'bg-white border-[#D1EBE0] shadow-2xs'
                : 'bg-white/60 border-[#E8E8E5] opacity-60'
            }`}>
              <div className="flex items-center justify-between pb-1">
                <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  1. Detected
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  AST Match
                </span>
              </div>
              <p className="text-[11px] text-[#686868] leading-relaxed">
                MY OWL detected breaking parameter usage at line {finding.line_number}.
              </p>
            </div>

            {/* Step 2: Migration Planned */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep >= 2
                ? 'bg-white border-[#D1EBE0] shadow-2xs'
                : currentStep === 1
                ? 'bg-white border-purple-300 shadow-2xs'
                : 'bg-white/60 border-[#E8E8E5] opacity-60'
            }`}>
              <div className="flex items-center justify-between pb-1">
                <span className={`font-semibold flex items-center gap-1.5 ${currentStep >= 2 ? 'text-emerald-950' : 'text-purple-950'}`}>
                  {currentStep >= 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-purple-600 flex items-center justify-center text-[10px] font-bold text-purple-700">2</div>
                  )}
                  2. Migration Planned
                </span>
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-medium border ${
                  currentStep >= 2
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-purple-50 text-purple-800 border-purple-200'
                }`}>
                  {currentStep >= 2 ? 'Verification Pending' : 'Next Action'}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${currentStep >= 2 ? 'text-[#686868]' : 'text-purple-900'}`}>
                {currentStep >= 2
                  ? 'Deterministic migration plan is ready. Source patching and verification run when you propose a Draft PR.'
                  : 'Click "Generate Migration Plan" to synthesize deterministic AST refactors.'}
              </p>
            </div>

            {/* Step 3: Draft PR Created */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep >= 3
                ? 'bg-white border-[#D1EBE0] shadow-2xs'
                : currentStep === 2
                ? 'bg-white border-purple-300 shadow-2xs'
                : 'bg-white/60 border-[#E8E8E5] opacity-60'
            }`}>
              <div className="flex items-center justify-between pb-1">
                <span className={`font-semibold flex items-center gap-1.5 ${currentStep >= 3 ? 'text-emerald-950' : 'text-zinc-700'}`}>
                  {currentStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-400 flex items-center justify-center text-[10px] font-bold text-zinc-600">3</div>
                  )}
                  3. Draft PR Created
                </span>
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-medium border ${
                  currentStep >= 3
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : currentStep === 2
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}>
                  {currentStep >= 3 && migration?.pr_number ? `PR #${migration.pr_number}` : currentStep === 2 ? 'Verification Pending' : 'Pending Plan'}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${currentStep >= 3 ? 'text-[#686868]' : 'text-zinc-600'}`}>
                {currentStep >= 3
                  ? 'Review the generated change on GitHub before human approval and merging.'
                  : 'Open a safe review-only Draft PR to an isolated branch on GitHub.'}
              </p>
            </div>
          </div>
        </div>

        {/* IMPACT VISUALIZATION FLOW */}
        <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686868]">
            AST Change Traversal Path
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">1. Vendor API Change ID</div>
              <div className="font-mono text-purple-700 font-semibold">{finding.change_id}</div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">2. Target Symbol</div>
              <div className="font-mono text-blue-700 font-semibold">{finding.symbol}</div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-white border border-[#E8E8E5] space-y-0.5">
              <div className="text-[10px] text-[#686868] font-semibold">3. Repository Call Site</div>
              <div className="font-mono text-[#111111] font-semibold">
                {finding.file_path}:{finding.line_number}
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-400 hidden md:block shrink-0" />

            <div className="w-full md:w-auto p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
              <div className="text-[10px] text-emerald-800 font-semibold">4. Detector Confidence</div>
              <div
                className="font-mono text-emerald-900 font-semibold flex items-center gap-1.5"
                title="Confidence reflects the detector's match strength for this known API-change rule."
              >
                <span>
                  {typeof finding.confidence === 'number' || !isNaN(Number(finding.confidence))
                    ? `${Math.round(Number(finding.confidence) * 100)}% — AST match`
                    : finding.confidence}
                </span>
                <span className="text-[10px] font-normal text-emerald-700 font-mono">
                  (score: {finding.confidence})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WORKBENCH SPLIT: LEFT CODE DIFF (65%) / RIGHT EVIDENCE & ACTIONS (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT 65%: CODE VIEW / DIFF PANEL */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                <FileCode className="w-4 h-4 text-purple-700" />
                <span>
                  {migration?.patch_diff
                    ? `Deterministic AST Transformation Patch — ${finding.file_path}`
                    : `Repository Source Evidence — ${finding.file_path}`}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#686868]">{finding.repo_name}</span>
            </div>

            {migration?.patch_diff ? (
              <div className="space-y-3">
                <div className="text-xs text-[#686868]">
                  Deterministic unified patch generated by AST engine for rule <code className="font-mono text-[11px] text-[#111111]">{finding.change_id}</code>.
                </div>
                <pre className="rounded-2xl bg-zinc-950 p-5 font-mono text-xs text-zinc-100 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800">
                  {migration.patch_diff}
                </pre>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-[#686868]">
                  Call site captured during static AST traversal at line {finding.line_number}:
                </div>
                <pre className="rounded-2xl bg-zinc-950 p-5 font-mono text-xs text-zinc-100 overflow-x-auto whitespace-pre leading-relaxed border border-zinc-800">
                  {finding.source_snippet || `// Call site location: ${finding.file_path}:${finding.line_number}\n${finding.symbol}`}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 35%: ACTIONS, EVIDENCE & PR */}
        <div className="lg:col-span-4 space-y-6">
          {/* ACTION PANEL */}
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700" />
              Migration Actions
            </h3>

            {!migration ? (
              <div className="space-y-3">
                <p className="text-xs text-[#686868] leading-relaxed">
                  Generate a deterministic migration plan for this breaking change. Source patching and verification happen before a Draft PR is created.
                </p>
                <Button
                  size="md"
                  variant="primary"
                  disabled={planning}
                  onClick={handleGeneratePlan}
                  className="w-full gap-2 font-medium"
                >
                  {planning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{planning ? "Planning Patch..." : "Generate Migration Plan"}</span>
                </Button>
              </div>
            ) : !migration.pr_number ? (
              <div className="space-y-4">
                <p className="text-xs text-[#686868] leading-relaxed">
                  Deterministic migration plan generated. Open a safe, review-only GitHub draft PR to an isolated feature branch.
                </p>

                {/* Pre-proposal branch & safety information */}
                <div className="p-3.5 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-2.5 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-[#686868]">Target Branch</div>
                    <div className="font-mono text-[11px] text-purple-900 bg-white px-2.5 py-1.5 rounded-lg border border-[#E8E8E5] break-all font-semibold">
                      {migration.target_branch || migration.branch_name || 'Pending assignment'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-[#686868]">Base Branch</div>
                    <div className="font-mono text-[11px] text-[#111111] bg-white px-2.5 py-1.5 rounded-lg border border-[#E8E8E5]">
                      {finding.default_branch || 'main'}
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Draft PR only • No direct writes to {finding.default_branch || 'main'}</span>
                  </div>
                </div>

                <Button
                  size="md"
                  variant="primary"
                  disabled={proposing}
                  onClick={handleProposePR}
                  className="w-full gap-2 font-medium"
                >
                  {proposing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitPullRequest className="w-4 h-4" />
                  )}
                  <span>{proposing ? "Opening Draft PR..." : "Propose Safe GitHub Draft PR"}</span>
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#EBF3FC] border border-[#C6E1FA] space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
                  <GitPullRequest className="w-4 h-4 text-blue-600" />
                  <span>{getPullRequestStateLabel(migration.pr_state)} · #{migration.pr_number}</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Target Branch: <code className="font-mono bg-white px-1 rounded border border-[#C6E1FA]">{migration.branch_name || migration.target_branch}</code>
                </p>
                <div className="pt-2">
                  <a href={migration.pr_url} target="_blank" rel="noreferrer" className="block">
                    <Button size="sm" variant="primary" className="w-full gap-1.5 text-xs">
                      <span>View on GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* VERIFICATION CONTRACT CARD */}
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Safety & Verification Invariants
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Draft-Only Policy</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-[11px] text-emerald-800">Direct merges & auto-merges are strictly blocked.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Isolated Branch Target</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-[11px] text-emerald-800">Default branch protected from automatic writes.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Patch Scope Enforcement</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-[11px] text-emerald-800">Critical files (.env, workflows, package configs) protected.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#EEF7F2] border border-[#D1EBE0] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Canonical Digest Verification</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-[11px] text-emerald-800 font-mono truncate">
                  {migration?.patch_digest ? `SHA256: ${migration.patch_digest.slice(0, 16)}...` : 'Computed prior to write.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
