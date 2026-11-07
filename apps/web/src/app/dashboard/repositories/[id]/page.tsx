"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import {
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Play,
  Loader2,
  RefreshCw,
  FileCode,
} from "lucide-react";

interface RepositoryDetail {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
  status: string;
  last_scan_at: string | null;
  created_at: string;
}

interface ScanRecord {
  id: string;
  sha: string;
  status: string;
  total_files: number;
  analyzed_files: number;
  findings_count: number;
  started_at: string;
  completed_at: string | null;
}

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
}

export default function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [repo, setRepo] = useState<RepositoryDetail | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${id}`);
      const json = await res.json() as { repository?: RepositoryDetail; scans?: ScanRecord[]; findings?: FindingRecord[]; error?: string };
      if (!res.ok || !json.repository) throw new Error(json.error || (res.ok ? "Repository not found or access denied." : "Unable to load repository details."));
      setRepo(json.repository);
      setScans(json.scans || []);
      setFindings(json.findings || []);
    } catch (err) {
      console.error("Failed to load repository detail:", err);
      setError(err instanceof Error ? err.message : "Unable to load repository details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleTriggerScan() {
    if (!repo) return;
    setScanning(true);
    setMessage({ text: "Triggering AST compatibility scan against repository..." });

    try {
      const res = await fetch(`/api/repositories/${repo.id}/scan`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scan execution failed.");
      }

      setMessage({
        text: `Scan complete: ${data.result.findingsCount} findings recorded.`,
      });
      await loadData();
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="py-20 text-center text-xs text-[#686868] font-sans">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
        <span>Loading repository details...</span>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="space-y-4 font-sans text-xs">
        <Link href="/dashboard/repositories" className="text-zinc-500 hover:text-black flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Repositories
        </Link>
        <DashboardDataError message={error || "Repository not found or access denied."} onRetry={() => void loadData()} />
      </div>
    );
  }

  const latestScan = scans[0];
  const latestScanIsActive = scanning || latestScan?.status === "pending" || latestScan?.status === "running";

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* BACK BUTTON */}
      <div>
        <Link
          href="/dashboard/repositories"
          className="inline-flex items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Repositories
        </Link>
      </div>

      {/* HERO BAND */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#111111]">
                {repo.name}
              </h1>
              <StatusPill
                status={findings.length > 0 ? "affected" : "healthy"}
                label={findings.length > 0 ? `${findings.length} Breaking Findings` : "All Gates Healthy"}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#686868] font-mono">
              <span>{repo.full_name}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5 text-purple-700" /> {repo.default_branch}
              </span>
              <span>·</span>
              <span>GitHub ID: {repo.github_repository_id}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs font-medium"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={scanning}
              onClick={handleTriggerScan}
              className="gap-1.5 text-xs font-medium"
            >
              {scanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{scanning ? "Analyzing AST..." : "Run AST Scan"}</span>
            </Button>
          </div>
        </div>

        {/* HONEST SCAN STATE BANNER */}
        <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              scanning
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : scans.length === 0
                ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                : scans[0]?.status === "failed"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : scans.length === 0 ? (
                <FileCode className="w-4 h-4" />
              ) : scans[0]?.status === "failed" ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="font-semibold text-[#111111] flex items-center gap-2">
                <span>Scan Status:</span>
                <span className="font-mono uppercase text-[11px] text-purple-800">
                  {scanning
                    ? "Scan in progress"
                    : scans.length === 0
                    ? "Not Scanned"
                    : scans[0]?.status === "failed"
                    ? "Scan Failed"
                    : "Scan Completed"}
                </span>
              </div>
              <p className="text-[11px] text-[#686868]">
                {scanning
                  ? "Running deterministic in-memory AST analysis against latest commit tree..."
                  : scans.length === 0
                  ? "No compatibility scans recorded yet. Trigger an AST scan to detect vendor breaking changes."
                  : scans[0]?.status === "failed"
                  ? "Previous scan encountered an issue fetching repository contents. Retry scan anytime."
                  : `Analyzed commit ${scans[0]?.sha ? scans[0].sha.slice(0, 8) : 'latest'} · ${findings.length} breaking change${findings.length === 1 ? '' : 's'} recorded.`}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Button
              size="sm"
              variant={scans[0]?.status === "failed" || scans.length === 0 ? "primary" : "outline"}
              disabled={scanning}
              onClick={handleTriggerScan}
              className="gap-1.5 text-xs font-medium"
            >
              {scanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{scanning ? "Analyzing AST..." : scans[0]?.status === "failed" ? "Retry Scan" : "Run AST Scan"}</span>
            </Button>
          </div>
        </div>

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
      </div>

      {/* REPOSITORY FINDINGS */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#111111] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-700" />
          Compatibility Findings ({findings.length})
        </h2>

        {findings.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#E8E8E5] rounded-[24px] space-y-2">
            {latestScanIsActive ? (
              <>
                <Loader2 className="w-6 h-6 text-purple-700 animate-spin mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">Scan in progress</p>
                <p className="text-xs text-[#686868]">MY OWL is analyzing the latest repository snapshot. Findings will appear when the scan completes.</p>
              </>
            ) : latestScan?.status === "failed" ? (
              <>
                <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">Scan failed</p>
                <p className="text-xs text-[#686868]">The latest scan did not complete. Review the status above and retry when the repository connection is available.</p>
              </>
            ) : latestScan ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">No breaking changes detected</p>
                <p className="text-xs text-[#686868]">The latest completed scan found no affected call sites in the reviewed provider rules.</p>
              </>
            ) : (
              <>
                <FileCode className="w-6 h-6 text-zinc-500 mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">No scan completed yet</p>
                <p className="text-xs text-[#686868]">Run an AST scan to inspect the repository with the reviewed provider rules.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs hover:border-[#111111]/30 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold uppercase">
                        {finding.provider}
                      </span>
                      <h3 className="text-sm font-semibold text-[#111111]">
                        {finding.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[#686868] leading-relaxed">
                      {finding.description}
                    </p>
                  </div>
                  <StatusPill status="affected" label={finding.severity.toUpperCase()} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Location</div>
                    <div className="font-mono text-[#111111] font-semibold">
                      {finding.file_path}:{finding.line_number}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Matched AST Symbol</div>
                    <div className="font-mono text-purple-700 font-semibold">{finding.symbol}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Detector Confidence</div>
                    <div
                      className="font-mono text-[#111111] font-semibold"
                      title="Confidence reflects the detector's match strength for this known API-change rule."
                    >
                      {typeof finding.confidence === 'number' || !isNaN(Number(finding.confidence))
                        ? `${Math.round(Number(finding.confidence) * 100)}% — AST match`
                        : finding.confidence}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[#E8E8E5]">
                  <span className="text-xs text-[#686868]">
                    Rule: <code className="font-mono text-[11px] text-[#111111]">{finding.change_id}</code>
                  </span>
                  <Link href={`/dashboard/findings/${finding.id}`}>
                    <Button size="sm" variant="primary" className="gap-1 text-xs font-medium">
                      <span>Inspect Evidence</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SCAN HISTORY TABLE */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
        <h2 className="text-base font-semibold text-[#111111] flex items-center gap-2">
          <FileCode className="w-4 h-4 text-purple-700" />
          Scan History ({scans.length})
        </h2>

        {scans.length === 0 ? (
          <p className="text-xs text-[#686868] py-4 text-center">No scans recorded yet.</p>
        ) : (
          <div role="region" aria-label="Repository scan history" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F6F4] border-b border-[#E8E8E5] text-[#686868] text-[10px] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Commit SHA</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Files Analyzed</th>
                  <th className="py-2.5 px-3">Findings</th>
                  <th className="py-2.5 px-3">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E5]">
                {scans.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F6F6F4]/50">
                    <td className="py-2.5 px-3 font-mono text-[#111111]">
                      {s.sha.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {s.analyzed_files} / {s.total_files}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {s.findings_count}
                    </td>
                    <td className="py-2.5 px-3 text-[#686868]">
                      {s.completed_at ? new Date(s.completed_at).toLocaleString() : 'In progress'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
