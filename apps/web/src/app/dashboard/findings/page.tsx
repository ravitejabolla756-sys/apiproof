"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { getPullRequestStateLabel } from "@/lib/compatibility-map-labels";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  GitPullRequest,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface FindingRecord {
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
  status: string;
  created_at: string;
  repo_name: string;
  repo_full_name: string;
  pr_number?: number | null;
  pr_url?: string | null;
  pr_state?: string | null;
  capability?: {
    migrationAvailable: boolean;
    recommendedNextAction: 'NO_ACTION' | 'MANUAL_REVIEW' | 'MIGRATION_AVAILABLE' | 'MIGRATION_NOT_AVAILABLE';
  } | null;
}

export default function FindingsListPage() {
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  async function loadFindings() {
    try {
      const res = await fetch("/api/findings");
      if (res.ok) {
        const json = await res.json();
        setFindings(json.findings || []);
      }
    } catch (err) {
      console.error("Failed to load findings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFindings();
  }, []);

  const filteredFindings = findings.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.file_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.repo_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === "all" || f.severity.toLowerCase() === severityFilter.toLowerCase();

    const matchesProvider =
      providerFilter === "all" || f.provider.toLowerCase() === providerFilter.toLowerCase();

    return matchesSearch && matchesSeverity && matchesProvider;
  });
  const providerOptions = ["all", ...Array.from(new Set(findings.map((finding) => finding.provider))).sort()];

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            API Compatibility Findings
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Deterministic AST detections matching third-party API breaking changes across monitored repositories.
          </p>
        </div>

        <Button
          onClick={loadFindings}
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            aria-label="Search findings"
            placeholder="Search symbol, file, or rule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#686868]">Severity:</span>
            {["all", "critical", "high"].map((sev) => (
              <button
                key={sev}
                type="button"
                aria-pressed={severityFilter === sev}
                aria-label={`Filter findings by ${sev} severity`}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                  severityFilter === sev
                    ? "bg-white text-[#111111] border-[#111111] shadow-2xs"
                    : "bg-transparent text-[#686868] border-transparent hover:text-[#111111]"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#686868]">Provider:</span>
            {providerOptions.map((prov) => (
              <button
                key={prov}
                type="button"
                aria-pressed={providerFilter === prov}
                aria-label={`Filter findings by ${prov} provider`}
                onClick={() => setProviderFilter(prov)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                  providerFilter === prov
                    ? "bg-white text-[#111111] border-[#111111] shadow-2xs"
                    : "bg-transparent text-[#686868] border-transparent hover:text-[#111111]"
                }`}
              >
                {prov}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FINDING ROW CARDS */}
      {loading ? (
        <div className="py-20 text-center text-[#686868]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Querying database findings...</span>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-semibold text-base text-[#111111]">No compatibility findings detected</p>
          <p className="text-xs text-[#686868]">
            Either all code call sites are compatible with upstream APIs, or repositories have not yet been scanned.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs hover:border-[#111111]/30 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold uppercase">
                      {finding.provider}
                    </span>
                    <h2 className="text-lg font-semibold text-[#111111]">
                      {finding.title}
                    </h2>
                  </div>
                  <p className="text-xs text-[#686868] leading-relaxed">
                    {finding.description}
                  </p>
                </div>

                <StatusPill
                  status={finding.pr_state === 'draft' || finding.pr_state === 'open' ? 'pr_created' : finding.pr_state === 'merged' ? 'healthy' : finding.pr_state === 'closed' ? 'warning' : finding.status === "migration_planned" ? "detected" : "neutral"}
                  label={finding.pr_number != null
                    ? `${getPullRequestStateLabel(finding.pr_state)} #${finding.pr_number}`
                    : finding.status === "migration_planned" ? "Evidence Ready" : "Detected"}
                />
                <span className={`text-[10px] uppercase font-mono px-2 py-1 rounded border ${finding.capability?.migrationAvailable ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                  {finding.capability?.migrationAvailable ? 'Migration available' : 'Review only'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Repository</div>
                  <div className="font-mono text-[#111111] font-semibold">{finding.repo_name}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Affected File</div>
                  <div className="font-mono text-[#111111] font-semibold">
                    {finding.file_path}:{finding.line_number}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Matched Symbol</div>
                  <div className="font-mono text-purple-700 font-semibold">{finding.symbol}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                  <div className="text-[10px] text-[#686868] uppercase font-semibold">Detector Confidence</div>
                  <div
                    className="text-[#111111] font-mono font-semibold"
                    title="Confidence reflects the detector's match strength for this known API-change rule."
                  >
                    {typeof finding.confidence === 'number' || !isNaN(Number(finding.confidence))
                      ? `${Math.round(Number(finding.confidence) * 100)}% — AST match`
                      : finding.confidence}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E8E8E5] flex items-center justify-between text-xs">
                <span className="text-[#686868] flex items-center gap-1.5 font-medium">
                  {finding.pr_number != null ? (
                    <>
                      <GitPullRequest className="w-4 h-4 text-blue-600" />
                      <span>{getPullRequestStateLabel(finding.pr_state)} · #{finding.pr_number}</span>
                    </>
                  ) : (
                    <span>Rule: <code className="font-mono text-[11px] text-[#111111]">{finding.change_id}</code></span>
                  )}
                </span>
                <Link href={`/dashboard/findings/${finding.id}`}>
                  <Button size="sm" variant="primary" className="gap-1 text-xs">
                    <span>Inspect Workbench & Plan</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
