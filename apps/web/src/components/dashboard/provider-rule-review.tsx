"use client";

import { useEffect, useState } from "react";
import { Check, Edit3, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";

type Candidate = {
  id: string;
  providerId: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  payload: Record<string, unknown> | null;
  source: { url: string; type: string };
  createdAt: string;
  reviewNotes: string | null;
  coverage: {
    priority: "P0" | "P1" | "P2";
    reviewBlockers: string[];
    evidenceClaims: number;
    hasExecutableTemplate: boolean;
    nextAction: "human-review" | "fixture-and-review" | "already-reviewed";
  } | null;
  reviewPack: {
    source: { claims: Array<{ key: string; value: string }>; locator?: string; fingerprint: string };
    facts: string[];
    unknowns: string[];
    fixturePlan: { detectorTokens: string[]; requiredOutcomes: string[] };
    reviewChecklist: string[];
    template: { status: string; limitation: string };
    reviewOnlyTemplateProposal?: {
      templateId: string;
      mode: "transform" | "manual-guidance";
      limitation: string;
      transformation?: { kind: string };
      guidance?: { summary: string; steps: string[]; validation: string[] };
    };
  } | null;
};

type CoverageSummary = {
  candidates: number;
  pendingCandidates: number;
  reviewedCandidates: number;
  reviewedProviders: number;
  providersMissingReviewedRules: string[];
  providersWithExecutableTemplates: string[];
};

const priorityStyles: Record<"P0" | "P1" | "P2", string> = {
  P0: "bg-rose-50 text-rose-700",
  P1: "bg-amber-50 text-amber-700",
  P2: "bg-slate-100 text-slate-600",
};

function detectorTokens(candidate: Candidate): string[] {
  const payload = candidate.payload ?? {};
  const values: string[] = [];
  for (const key of ["apiOperationPatterns", "affectedModels", "affectedEndpoints", "affectedParameters", "affectedResponseFields", "affectedDomains", "affectedResources", "authOrHeaderPatterns"]) {
    const value = payload[key];
    if (Array.isArray(value)) for (const item of value) if (typeof item === "string" && item.trim()) values.push(item.trim());
  }
  const version = payload.apiVersionMetadata;
  if (version && typeof version === "object" && !Array.isArray(version)) {
    for (const key of ["version", "replacement"]) {
      const value = (version as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) values.push(value.trim());
    }
  }
  return [...new Set(values)].slice(0, 20);
}

export function ProviderRuleReview() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "P0" | "P1" | "P2">("all");
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sampleCode, setSampleCode] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, { matches: Array<{ token: string; line: number; snippet: string }> }>>({});
  const [reviewEvidence, setReviewEvidence] = useState<Record<string, { affected: string; unaffected: string; uncertain: string }>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, { title: string; description: string; patterns: string; replacement: string; migrationTemplate: string; notes: string }>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/provider-rules", { cache: "no-store" });
      const body = await response.json() as { candidates?: Candidate[]; coverageSummary?: CoverageSummary; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to load provider rules.");
      setCandidates(body.candidates ?? []);
      setCoverageSummary(body.coverageSummary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load provider rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function seedReviewQueue() {
    setSeeding(true);
    setError(null);
    try {
      const response = await fetch('/api/provider-rules/seed', { method: 'POST' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to populate provider review queue.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to populate provider review queue.');
    } finally {
      setSeeding(false);
    }
  }

  const visibleCandidates = priorityFilter === "all"
    ? candidates
    : candidates.filter((candidate) => candidate.coverage?.priority === priorityFilter);

  async function review(candidate: Candidate, decision: "approve" | "reject") {
    const reviewNotes = notes[candidate.id]?.trim() ?? "";
    if (!reviewNotes) {
      setError("Add review notes before approving or rejecting a rule.");
      return;
    }
    const evidence = reviewEvidence[candidate.id] ?? { affected: "", unaffected: "", uncertain: "" };
    if (decision === "approve" && (!evidence.affected.trim() || !evidence.unaffected.trim() || !evidence.uncertain.trim())) {
      setError("Approval requires affected, unaffected, and uncertain evidence examples.");
      return;
    }
    setBusy(candidate.id);
    setError(null);
    try {
      const response = await fetch(`/api/provider-rules/${encodeURIComponent(candidate.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: reviewNotes,
          ...(decision === "approve" ? { reviewEvidence: {
            cases: [
              { kind: "affected", filePath: "review/affected.ts", code: evidence.affected.trim(), rationale: "Observed the candidate token in affected usage." },
              { kind: "unaffected", filePath: "review/unaffected.ts", code: evidence.unaffected.trim(), rationale: "Confirmed this usage does not match the candidate token." },
              { kind: "uncertain", filePath: "review/uncertain.ts", code: evidence.uncertain.trim(), rationale: "Requires follow-up review because the usage is ambiguous." },
            ],
          } } : {}),
        }),
      });
      const body = await response.json() as { error?: string; code?: string };
      if (!response.ok) throw new Error(body.code ? `${body.error ?? "Rule review failed."} (${body.code})` : (body.error ?? "Rule review failed."));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rule review failed.");
    } finally {
      setBusy(null);
    }
  }

  function setEvidence(candidateId: string, kind: "affected" | "unaffected" | "uncertain", value: string) {
    setReviewEvidence((current) => {
      const existing = current[candidateId] ?? { affected: "", unaffected: "", uncertain: "" };
      return { ...current, [candidateId]: { ...existing, [kind]: value } };
    });
  }

  async function test(candidate: Candidate) {
    const code = sampleCode[candidate.id]?.trim() ?? "";
    if (!code) { setError("Paste sample code before testing a rule."); return; }
    setBusy(candidate.id);
    setError(null);
    try {
      const response = await fetch(`/api/provider-rules/${encodeURIComponent(candidate.id)}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, filePath: "sample.ts" }) });
      const body = await response.json() as { matches?: Array<{ token: string; line: number; snippet: string }>; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Rule test failed.");
      setTestResults((current) => ({ ...current, [candidate.id]: { matches: body.matches ?? [] } }));
    } catch (err) { setError(err instanceof Error ? err.message : "Rule test failed."); }
    finally { setBusy(null); }
  }

  function editState(candidate: Candidate) {
    const payload = candidate.payload ?? {};
    const patterns = Array.isArray(payload.apiOperationPatterns) ? payload.apiOperationPatterns.join("\n") : "";
    const replacement = payload.replacement && typeof payload.replacement === "object" ? JSON.stringify(payload.replacement, null, 2) : "";
    const migrationTemplate = payload.migrationTemplate && typeof payload.migrationTemplate === "object" ? JSON.stringify(payload.migrationTemplate, null, 2) : "";
    return editValues[candidate.id] ?? { title: candidate.title, description: candidate.description, patterns, replacement, migrationTemplate, notes: "" };
  }

  function useReviewProposal(candidate: Candidate) {
    const proposal = candidate.reviewPack?.reviewOnlyTemplateProposal;
    if (!proposal || proposal.mode !== "transform" || !proposal.transformation) return;
    const current = editState(candidate);
    const migrationTemplate = JSON.stringify({
      transformation: proposal.transformation,
      sources: [candidate.source.url],
      limitations: [proposal.limitation],
    }, null, 2);
    setEditValues((values) => ({ ...values, [candidate.id]: { ...current, migrationTemplate, notes: "" } }));
    setEditing((values) => ({ ...values, [candidate.id]: true }));
    setError(null);
  }

  async function saveEdit(candidate: Candidate) {
    const value = editState(candidate);
    if (!value.notes.trim()) { setError("Add an audit note describing the edit before saving."); return; }
    let replacement: unknown = undefined;
    let migrationTemplate: unknown = undefined;
    if (value.replacement.trim()) {
      try { replacement = JSON.parse(value.replacement); } catch { setError("Replacement guidance must be valid JSON."); return; }
    }
    if (value.migrationTemplate.trim()) {
      try { migrationTemplate = JSON.parse(value.migrationTemplate); } catch { setError("Migration template must be valid JSON."); return; }
    }
    setBusy(candidate.id); setError(null);
    try {
      const response = await fetch(`/api/provider-rules/${encodeURIComponent(candidate.id)}/edit`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value.title, description: value.description, apiOperationPatterns: value.patterns.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), ...(replacement === undefined ? {} : { replacement }), ...(migrationTemplate === undefined ? {} : { migrationTemplate }), notes: value.notes }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Rule edit failed.");
      setEditing((current) => ({ ...current, [candidate.id]: false }));
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Rule edit failed."); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6 max-w-[1100px] font-sans text-xs">
      <div className="flex flex-col gap-3 border-b border-[#E8E8E5] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-700">Provider intelligence</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-[#111111]">Rule review</h1>
          <p className="mt-1 max-w-2xl text-xs text-[#686868]">Review evidence from provider changelogs before MY OWL uses it in compatibility scans. Approval is workspace-scoped and queues a rescan for connected repositories.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D9D4] bg-white px-3 py-2 font-medium text-[#333333] hover:bg-[#F6F6F4]" disabled={loading || seeding}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={() => void seedReviewQueue()} className="rounded-lg bg-[#111111] px-3 py-2 font-medium text-white hover:bg-[#333333] disabled:opacity-50" disabled={loading || seeding}>
            {seeding ? 'Populating…' : 'Populate official queue'}
          </button>
        </div>
      </div>

      {error && <div role="alert" aria-live="assertive" aria-atomic="true" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">{error}</div>}
      {coverageSummary && <section className="grid gap-3 sm:grid-cols-3" aria-label="Provider review coverage"><div className="rounded-xl border border-[#E8E8E5] bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#686868]">Reviewed providers</p><p className="mt-2 text-2xl font-semibold text-[#111111]">{coverageSummary.reviewedProviders} <span className="text-sm font-normal text-[#686868]">/ 19</span></p><p className="mt-1 text-[11px] text-[#686868]">Rules promoted with evidence</p></div><div className="rounded-xl border border-[#E8E8E5] bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#686868]">Pending candidates</p><p className="mt-2 text-2xl font-semibold text-[#111111]">{coverageSummary.pendingCandidates}</p><p className="mt-1 text-[11px] text-[#686868]">Require human fixtures and review</p></div><div className="rounded-xl border border-[#E8E8E5] bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#686868]">Guarded templates</p><p className="mt-2 text-2xl font-semibold text-[#111111]">{coverageSummary.providersWithExecutableTemplates.length}</p><p className="mt-1 text-[11px] text-[#686868]">Providers with deterministic remediation</p></div></section>}
      {coverageSummary && coverageSummary.providersMissingReviewedRules.length > 0 && <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-[11px] text-amber-900"><span className="font-semibold">Providers still needing reviewed rules:</span> {coverageSummary.providersMissingReviewedRules.join(", ")}</div>}
      {!loading && candidates.length > 0 && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Review priority filter"><span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#686868]">Focus:</span>{(["all", "P0", "P1", "P2"] as const).map((priority) => <button key={priority} type="button" aria-pressed={priorityFilter === priority} onClick={() => setPriorityFilter(priority)} className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${priorityFilter === priority ? "border-[#111111] bg-[#111111] text-white" : "border-[#D9D9D4] bg-white text-[#555555] hover:bg-[#F6F6F4]"}`}>{priority === "all" ? `All (${candidates.length})` : `${priority} (${candidates.filter((candidate) => candidate.coverage?.priority === priority).length})`}</button>)}</div>}
      {loading ? <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-[#E8E8E5] bg-white p-8 text-[#686868]">Loading provider evidence…</div> : candidates.length === 0 ? <div className="rounded-xl border border-[#E8E8E5] bg-white p-8 text-center text-[#686868]"><p>No provider rule candidates are waiting for review.</p><p className="mt-2 text-[11px]">Populate the official evidence queue to begin human review. This creates needs-review records only.</p><button type="button" onClick={() => void seedReviewQueue()} disabled={seeding} className="mt-4 rounded-lg bg-[#111111] px-3 py-2 font-medium text-white disabled:opacity-50">{seeding ? 'Populating…' : 'Populate official queue'}</button></div> : visibleCandidates.length === 0 ? <div className="rounded-xl border border-[#E8E8E5] bg-white p-8 text-center text-[#686868]">No candidates match this review priority.</div> : (
        <div className="space-y-4">
          {visibleCandidates.map((candidate) => {
            const pending = candidate.status === "needs_review";
            const result = testResults[candidate.id];
            return <article key={candidate.id} className="rounded-xl border border-[#E8E8E5] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700">{candidate.providerId}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{candidate.status}</span>{candidate.coverage && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${priorityStyles[candidate.coverage.priority]}`}>{candidate.coverage.priority} review</span>}</div>
                  <h2 className="mt-3 text-base font-semibold text-[#111111]">{candidate.title}</h2>
                  <p className="mt-1 leading-5 text-[#686868]">{candidate.description}</p>
                </div>
                <a href={candidate.source.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-purple-700 hover:underline">Source <ExternalLink className="h-3 w-3" /></a>
              </div>
              {pending && candidate.coverage && <div className="mt-4 rounded-lg border border-[#E8E8E5] bg-[#FAFAF8] p-3 text-[11px] text-[#555555]"><div className="flex flex-wrap items-center justify-between gap-2"><span><span className="font-semibold text-[#333333]">Review readiness:</span> {candidate.coverage.evidenceClaims} source claim(s), {candidate.coverage.hasExecutableTemplate ? "guarded template available" : "review-only remediation"}</span><span className="font-semibold text-[#333333]">{candidate.coverage.nextAction === "fixture-and-review" ? "Submit fixture evidence" : "Review"}</span></div>{candidate.coverage.reviewBlockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-[#686868]">{candidate.coverage.reviewBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</div>}
              {pending && candidate.reviewPack && <details className="mt-4 rounded-lg border border-purple-100 bg-purple-50/30 p-3 text-[11px] text-[#555555]"><summary className="cursor-pointer font-semibold text-purple-900">Open evidence review pack</summary><div className="mt-3 space-y-3"><div><p className="font-semibold text-[#333333]">Official claims</p>{candidate.reviewPack.source.claims.length ? <ul className="mt-1 list-disc space-y-1 pl-4">{candidate.reviewPack.source.claims.map((claim) => <li key={`${claim.key}:${claim.value}`}><span className="font-medium">{claim.key}:</span> {claim.value}</li>)}</ul> : <p className="mt-1">No structured claims were recorded.</p>}</div>{candidate.reviewPack.facts.length > 0 && <div><p className="font-semibold text-[#333333]">Recorded facts</p><ul className="mt-1 list-disc space-y-1 pl-4">{candidate.reviewPack.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>}{candidate.reviewPack.unknowns.length > 0 && <div><p className="font-semibold text-amber-900">Unknowns to resolve</p><ul className="mt-1 list-disc space-y-1 pl-4 text-amber-900">{candidate.reviewPack.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}<div><p className="font-semibold text-[#333333]">Required fixture outcomes</p><p className="mt-1">{candidate.reviewPack.fixturePlan.requiredOutcomes.join(", ")}; detector tokens: {candidate.reviewPack.fixturePlan.detectorTokens.join(", ") || "none"}</p></div><div><p className="font-semibold text-[#333333]">Review checklist</p><ul className="mt-1 list-disc space-y-1 pl-4">{candidate.reviewPack.reviewChecklist.map((item) => <li key={item}>{item}</li>)}</ul></div><p className="text-[#686868]">Remediation status: {candidate.reviewPack.template.status}. {candidate.reviewPack.template.limitation}</p>{candidate.reviewPack.reviewOnlyTemplateProposal && <div className="rounded-md border border-purple-100 bg-white p-2"><p className="font-semibold text-purple-900">Review-only {candidate.reviewPack.reviewOnlyTemplateProposal.mode === "manual-guidance" ? "migration playbook" : "proposal"}</p><p className="mt-1"><code>{candidate.reviewPack.reviewOnlyTemplateProposal.templateId}</code></p><p className="mt-1 text-[#686868]">{candidate.reviewPack.reviewOnlyTemplateProposal.limitation}</p>{candidate.reviewPack.reviewOnlyTemplateProposal.mode === "manual-guidance" && candidate.reviewPack.reviewOnlyTemplateProposal.guidance && <><p className="mt-2 font-medium text-[#333333]">{candidate.reviewPack.reviewOnlyTemplateProposal.guidance.summary}</p><ol className="mt-1 list-decimal space-y-1 pl-4">{candidate.reviewPack.reviewOnlyTemplateProposal.guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-2 font-medium text-[#333333]">Validation</p><ul className="mt-1 list-disc space-y-1 pl-4">{candidate.reviewPack.reviewOnlyTemplateProposal.guidance.validation.map((item) => <li key={item}>{item}</li>)}</ul></>}</div>}</div></details>}
              {pending && editing[candidate.id] ? <div className="mt-4 space-y-3 rounded-lg border border-purple-100 bg-purple-50/40 p-4">
                {(() => { const value = editState(candidate); const set = (key: keyof typeof value, next: string) => setEditValues((current) => ({ ...current, [candidate.id]: { ...value, [key]: next } })); return <>
                  <input value={value.title} onChange={(event) => set("title", event.target.value)} className="w-full rounded-lg border border-[#D9D9D4] bg-white p-2 text-xs" aria-label="Rule title" />
                  <textarea value={value.description} onChange={(event) => set("description", event.target.value)} className="min-h-20 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 text-xs" aria-label="Rule description" />
                  <textarea value={value.patterns} onChange={(event) => set("patterns", event.target.value)} placeholder="One operation pattern per line" className="min-h-20 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 font-mono text-[11px]" aria-label="Operation patterns" />
                  <textarea value={value.replacement} onChange={(event) => set("replacement", event.target.value)} placeholder='Optional replacement JSON, for example {"operation":"newOperation"}' className="min-h-20 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 font-mono text-[11px]" aria-label="Replacement guidance" />
                  <div><textarea value={value.migrationTemplate} onChange={(event) => set("migrationTemplate", event.target.value)} placeholder={'Optional executable template JSON; sources must include the official source URL.\n{"transformation":{"kind":"member-rename","from":"old","to":"new","receiver":"client","preserveArguments":true},"sources":["' + candidate.source.url + '"],"limitations":["Direct calls only."]}'} className="min-h-32 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 font-mono text-[11px]" aria-label="Migration template" /><p className="mt-1 text-[10px] text-[#686868]">Optional guarded remediation. It is validated, source-bound, and still requires human review.</p></div>
                  <textarea value={value.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Audit note for this edit" className="min-h-16 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 text-xs" aria-label="Edit audit note" />
                  <div className="flex gap-2"><button disabled={busy === candidate.id} onClick={() => void saveEdit(candidate)} className="rounded-lg bg-[#111111] px-3 py-2 font-medium text-white disabled:opacity-50">Save edit</button><button disabled={busy === candidate.id} onClick={() => setEditing((current) => ({ ...current, [candidate.id]: false }))} className="rounded-lg border border-[#D9D9D4] px-3 py-2 font-medium text-[#444444]">Cancel</button></div>
                </>; })()}
              </div> : <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-[#F6F6F4] p-3 text-[11px] text-[#444444]">{JSON.stringify(candidate.payload ?? {}, null, 2)}</pre>}
              {pending ? <>
                <div className="mt-4 rounded-lg border border-[#E8E8E5] bg-[#FAFAF8] p-3 text-[11px] text-[#555555]"><span className="font-semibold text-[#333333]">Detector tokens to exercise:</span> {detectorTokens(candidate).join(", ") || "none extracted; keep this candidate review-only until a bounded token is defined."}</div>
                <textarea aria-label={`Sample code for ${candidate.title}`} value={sampleCode[candidate.id] ?? ""} onChange={(event) => setSampleCode((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="Optional: paste a small code sample to test the detected model, endpoint, or parameter…" className="mt-4 min-h-20 w-full rounded-lg border border-[#D9D9D4] bg-white p-3 font-mono text-[11px] outline-none focus:border-purple-400" />
                <div className="mt-2 flex items-center gap-3"><button disabled={busy === candidate.id} onClick={() => void test(candidate)} className="rounded-lg border border-[#D9D9D4] px-3 py-2 font-medium text-[#444444] disabled:opacity-50">Test sample</button>{result && <span className="text-[#686868]">{result.matches.length} matching occurrence(s)</span>}</div>
                {result?.matches.length ? <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-emerald-900">{result.matches.slice(0, 5).map((match, index) => <p key={`${match.token}-${match.line}-${index}`}>Line {match.line}: <code>{match.token}</code> — {match.snippet}</p>)}</div> : null}
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                  <p className="font-semibold text-amber-900">Approval evidence</p>
                  <p className="mt-1 text-[10px] leading-4 text-amber-900/80">Provide one small example for each outcome. MY OWL validates affected and unaffected examples against the detected literal evidence before approval.</p>
                  {(["affected", "unaffected", "uncertain"] as const).map((kind) => <textarea key={kind} value={reviewEvidence[candidate.id]?.[kind] ?? ""} onChange={(event) => setEvidence(candidate.id, kind, event.target.value)} placeholder={`${kind.charAt(0).toUpperCase()}${kind.slice(1)} example code`} className="mt-2 min-h-16 w-full rounded-lg border border-[#D9D9D4] bg-white p-2 font-mono text-[11px]" aria-label={`${kind} review evidence`} />)}
                </div>
                <label className="mt-4 block text-xs font-semibold text-[#444444]" htmlFor={`review-notes-${candidate.id}`}>Review notes <span className="font-normal text-[#686868]">(required for the audit trail)</span></label>
                <textarea id={`review-notes-${candidate.id}`} value={notes[candidate.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="Explain the evidence and why this rule is safe to publish…" aria-label="Review notes" aria-required="true" className="mt-2 min-h-20 w-full rounded-lg border border-[#D9D9D4] bg-white p-3 text-xs outline-none focus:border-purple-400" />
                <div className="mt-3 flex flex-wrap gap-2">{candidate.reviewPack?.reviewOnlyTemplateProposal?.mode === "transform" && <button disabled={busy === candidate.id || editing[candidate.id]} onClick={() => useReviewProposal(candidate)} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 font-medium text-purple-800 disabled:opacity-50">Use review proposal</button>}<button disabled={busy === candidate.id || editing[candidate.id]} onClick={() => setEditing((current) => ({ ...current, [candidate.id]: true }))} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D9D4] px-3 py-2 font-medium text-[#444444] disabled:opacity-50"><Edit3 className="h-3.5 w-3.5" /> Edit rule</button><button disabled={busy === candidate.id || editing[candidate.id]} onClick={() => void review(candidate, "approve")} className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-3 py-2 font-medium text-white disabled:opacity-50"><>{busy === candidate.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</> Approve and rescan</button><button disabled={busy === candidate.id || editing[candidate.id]} onClick={() => void review(candidate, "reject")} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D9D4] px-3 py-2 font-medium text-[#444444] disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button></div>
              </> : <p className="mt-4 text-[#686868]">Reviewed {candidate.reviewNotes ? `— ${candidate.reviewNotes}` : ""}</p>}
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
