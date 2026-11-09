"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import { formatDisplayDateTime } from "@/lib/date-display-contract";
import { parseRepositoryDetailResponse, type RepositoryDetailResponse } from "@/lib/repository-detail-contract";
import { parseRepositoryScanResponse } from "@/lib/repository-scan-contract";
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

type RepositoryDetail = RepositoryDetailResponse['repository'];
type ScanRecord = RepositoryDetailResponse['scans'][number];
type FindingRecord = RepositoryDetailResponse['findings'][number];

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
    try {
      const res = await fetch(`/api/repositories/${id}`);
      const json = await res.json() as unknown;
      const parsed = parseRepositoryDetailResponse(json);
      if (!res.ok || !parsed) {
        const error = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : undefined;
        throw new Error(error || (res.ok ? "Repository details Unavailable." : "Unable to load repository details."));
      }
      setRepo(parsed.repository);
      setScans(parsed.scans);
      setFindings(parsed.findings);
      setError(null);
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
      const data = await res.json() as unknown;
      const parsed = parseRepositoryScanResponse(data);
      const error = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : undefined;

      if (!res.ok || !parsed) {
        throw new Error(error || "Scan execution failed.");
      }

      setMessage({
        text: `Scan complete: ${parsed.findingsCount} findings recorded.`,
      });
      await loadData();
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setScanning(false);
    }
  }

  if (loading && !repo && !error) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="py-20 text-center text-xs text-[#686868] font-sans">
        <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
        <span>Loading repository details...</span>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="space-y-4 font-sans text-xs">
        <Link href="/dashboard/repositories" className="inline-flex min-h-11 items-center gap-1 text-zinc-600 hover:text-black">
          <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" /> Back to Repositories
        </Link>
        <DashboardDataError message={error || "Repository not found or access denied."} onRetry={() => void loadData()} busy={loading} />
      </div>
    );
  }

  const latestScan = scans[0];
  const latestScanIsActive = scanning || latestScan?.status === "pending" || latestScan?.status === "running";

  return (
    <div aria-busy={loading || scanning ? 'true' : undefined} className="min-w-0 space-y-6 max-w-[1440px] font-sans text-xs">
      {/* BACK BUTTON */}
      <div>
        <Link
          href="/dashboard/repositories"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
          Back to Repositories
        </Link>
      </div>

      {/* HERO BAND */}
      <div className="min-w-0 rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="min-w-0 break-words text-2xl font-bold font-mono text-[#111111]">
                {repo.name}
              </h1>
              <StatusPill
                status={findings.length > 0 ? "affected" : "healthy"}
                label={findings.length > 0 ? `${findings.length} Breaking Findings` : "All Gates Healthy"}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[#686868] font-mono">
              <span className="break-all">{repo.full_name}</span>
              <span className="shrink-0">·</span>
              <span className="flex min-w-0 items-center gap-1 break-all">
                <GitBranch aria-hidden="true" className="w-3.5 h-3.5 text-purple-700" /> {repo.default_branch}
              </span>
              <span className="shrink-0">·</span>
              <span className="break-all">GitHub ID: {repo.github_repository_id}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              disabled={loading}
              aria-busy={loading ? 'true' : undefined}
              icon={<RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
              className="min-h-11 text-xs font-medium"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={scanning}
              aria-busy={scanning ? 'true' : undefined}
              onClick={handleTriggerScan}
              className="min-h-11 gap-1.5 text-xs font-medium"
            >
              {scanning ? (
                <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="w-3.5 h-3.5" />
              )}
              <span>{scanning ? "Analyzing AST..." : "Run AST Scan"}</span>
            </Button>
          </div>
        </div>

        {/* HONEST SCAN STATE BANNER */}
        <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div aria-hidden="true" className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              scanning
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : scans.length === 0
                ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                : scans[0]?.status === "failed"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {scanning ? (
                <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
              ) : scans.length === 0 ? (
                <FileCode aria-hidden="true" className="w-4 h-4" />
              ) : scans[0]?.status === "failed" ? (
                <AlertTriangle aria-hidden="true" className="w-4 h-4" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="w-4 h-4" />
              )}
            </div>

            <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0 space-y-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2 font-semibold text-[#111111]">
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
              <p className="break-words text-[11px] text-[#686868]">
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
              aria-busy={scanning ? 'true' : undefined}
              onClick={handleTriggerScan}
              className="min-h-11 gap-1.5 text-xs font-medium"
            >
              {scanning ? (
                <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="w-3.5 h-3.5" />
              )}
              <span>{scanning ? "Analyzing AST..." : scans[0]?.status === "failed" ? "Retry Scan" : "Run AST Scan"}</span>
            </Button>
          </div>
        </div>

        {message && (
          <div
            role={message.error ? "alert" : "status"}
            aria-live={message.error ? "assertive" : "polite"}
            aria-atomic="true"
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.error
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-emerald-50 text-emerald-900 border border-emerald-200"
            }`}
          >
            {message.error ? (
              <AlertTriangle aria-hidden="true" className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* REPOSITORY FINDINGS */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#111111] flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="w-4 h-4 text-purple-700" />
          Compatibility Findings ({findings.length})
        </h2>

        {findings.length === 0 ? (
          <div role="status" aria-live="polite" aria-atomic="true" className="p-8 text-center bg-white border border-[#E8E8E5] rounded-[24px] space-y-2">
            {latestScanIsActive ? (
              <>
                <Loader2 aria-hidden="true" className="w-6 h-6 text-purple-700 animate-spin mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">Scan in progress</p>
                <p className="text-xs text-[#686868]">MY OWL is analyzing the latest repository snapshot. Findings will appear when the scan completes.</p>
              </>
            ) : latestScan?.status === "failed" ? (
              <>
                <AlertTriangle aria-hidden="true" className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">Scan failed</p>
                <p className="text-xs text-[#686868]">The latest scan did not complete. Review the status above and retry when the repository connection is available.</p>
              </>
            ) : latestScan ? (
              <>
                <CheckCircle2 aria-hidden="true" className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-semibold text-sm text-[#111111]">No breaking changes detected</p>
                <p className="text-xs text-[#686868]">The latest completed scan found no affected call sites in the reviewed provider rules.</p>
              </>
            ) : (
              <>
                <FileCode aria-hidden="true" className="w-6 h-6 text-zinc-500 mx-auto" />
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
                className="min-w-0 rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs hover:border-[#111111]/30 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="max-w-full break-all px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold uppercase">
                        {finding.provider}
                      </span>
                      <h3 className="break-words text-sm font-semibold text-[#111111]">
                        {finding.title}
                      </h3>
                    </div>
                    <p className="break-words text-xs text-[#686868] leading-relaxed">
                      {finding.description}
                    </p>
                  </div>
                  <StatusPill status="affected" label={finding.severity.toUpperCase()} />
                </div>

                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="min-w-0 p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Location</div>
                    <div className="break-all font-mono text-[#111111] font-semibold">
                      {finding.file_path}:{finding.line_number}
                    </div>
                  </div>
                  <div className="min-w-0 p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Matched AST Symbol</div>
                    <div className="break-all font-mono text-purple-700 font-semibold">{finding.symbol}</div>
                  </div>
                  <div className="min-w-0 p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
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

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E8E5] pt-2">
                  <span className="break-words text-xs text-[#686868]">
                    Rule: <code className="font-mono text-[11px] text-[#111111]">{finding.change_id}</code>
                  </span>
                  <Link href={`/dashboard/findings/${finding.id}`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#111111] px-3.5 py-2 text-xs font-sans font-medium text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/20 active:scale-[0.99]">
                    <span>Inspect Evidence</span>
                    <ExternalLink aria-hidden="true" className="w-3 h-3" />
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
          <FileCode aria-hidden="true" className="w-4 h-4 text-purple-700" />
          Scan History ({scans.length})
        </h2>

        {scans.length === 0 ? (
          <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-[#686868] py-4 text-center">No scans recorded yet.</p>
        ) : (
          <div role="region" aria-label="Repository scan history" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F6F4] border-b border-[#E8E8E5] text-[#686868] text-[10px] font-semibold uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-3">Commit SHA</th>
                  <th scope="col" className="py-2.5 px-3">Status</th>
                  <th scope="col" className="py-2.5 px-3">Files Analyzed</th>
                  <th scope="col" className="py-2.5 px-3">Findings</th>
                  <th scope="col" className="py-2.5 px-3">Completed At</th>
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
                      {s.files_analyzed}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {s.findings_count}
                    </td>
                    <td className="py-2.5 px-3 text-[#686868]">
                      {s.completed_at ? formatDisplayDateTime(s.completed_at) : 'In progress'}
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
