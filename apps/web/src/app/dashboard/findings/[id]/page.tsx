"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
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
  pr_state?: string;
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

      setMessage({ text: "Deterministic migration plan generated and verified." });
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

      setMessage({ text: `Safe draft PR #${data.proposal.number} opened on branch ${data.proposal.branchName}.` });
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
                status={migration.pr_number ? "pr_created" : "verified"}
                label={migration.pr_number ? `Draft PR #${migration.pr_number}` : "Migration Planned"}
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
              <div className="text-[10px] text-emerald-800 font-semibold">4. Confidence</div>
              <div className="font-mono text-emerald-900 font-semibold">{finding.confidence}</div>
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
                  Generate a validated AST patch for this breaking change using the deterministic planner.
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
              <div className="space-y-3">
                <p className="text-xs text-[#686868] leading-relaxed">
                  Deterministic migration plan generated. Open a safe, review-only GitHub draft PR to isolated feature branch.
                </p>
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
                  <span>Draft PR #{migration.pr_number} Active</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Target Branch: <code className="font-mono bg-white px-1 rounded border border-[#C6E1FA]">{migration.branch_name}</code>
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
