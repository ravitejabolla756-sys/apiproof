"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusPill, type StatusVariant } from "@/components/ui/status-pill";
import { getProofMatchedTarget, getPullRequestStateLabel, getRegistryCoverageDescription, getRegistryCoverageLabel } from "@/lib/compatibility-map-labels";
import { AlertTriangle, ArrowUpRight, CheckCircle2, GitBranch, Layers, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

interface CompatibilityFinding {
  id: string;
  provider: string;
  title: string;
  status: string;
  filePath: string;
  symbol: string;
  migration: { id: string; status: string | null } | null;
  pullRequest: { id: string; number: number | null; state: string | null; url: string | null; createdAt: string | null } | null;
}

interface CompatibilityRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  latestScanStatus: string;
  latestCompletedScan: {
    id: string;
    sha: string | null;
    baselineSha: string | null;
    filesAnalyzed: number;
    findingsCount: number;
    completedAt: string | null;
  } | null;
  analysisEvidenceAvailable: boolean;
  integrations: Array<{
    provider: string;
    providerName?: string;
    detected: boolean;
    usageCount: number | null;
    mappedSymbolCount: number | null;
    reviewedChangeCount: number;
    packageName?: string | null;
    declaredVersion?: string | null;
    resolvedVersion?: string | null;
    versionConfidence?: string | null;
    capability?: string | null;
    capabilities?: string[];
  }>;
  openFindingCount: number;
  findings: CompatibilityFinding[];
  compatibilityProofs?: Array<{
    providerId: string;
    changeId: string;
    status: string;
    changeTitle?: string;
    severity?: string;
    exactFile?: string | null;
    exactLine?: number | null;
    matchedModel?: string | null;
    matchedResource?: string | null;
    matchedEndpoint?: string | null;
    matchedDomain?: string | null;
    matchedParameter?: string | null;
    matchedResponseField?: string | null;
    matchedAuthOrHeader?: string | null;
    officialSourceUrl?: string;
    removalAt?: string | null;
    reasonCodes?: string[];
  }>;
}

interface CompatibilityMapResponse {
  repositories: CompatibilityRepository[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 2048): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function nullableText(value: unknown, max = 2048): string | null | undefined {
  return value === null ? null : text(value, max) ?? undefined;
}

function count(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function stringList(value: unknown, maxItems = 128): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = value.map((item) => text(item, 512));
  return result.every((item): item is string => item !== null) ? result : null;
}

function parsePullRequest(value: unknown): CompatibilityFinding['pullRequest'] {
  if (value === null) return null;
  if (!record(value)) return null;
  const id = text(value.id, 256); const number = value.number === null ? null : count(value.number);
  const state = nullableText(value.state, 128); const url = nullableText(value.url, 2048); const createdAt = nullableText(value.createdAt, 128);
  return id && number !== undefined && state !== undefined && createdAt !== undefined && (url === null || (url !== undefined && /^https:\/\//i.test(url)))
    ? { id, number, state, url: url ?? null, createdAt } : null;
}

function parseFinding(value: unknown): CompatibilityFinding | null {
  if (!record(value)) return null;
  const id = text(value.id, 256); const provider = text(value.provider, 256); const title = text(value.title, 1024); const status = text(value.status, 128);
  const filePath = text(value.filePath, 4096); const symbol = text(value.symbol, 1024);
  let migration: CompatibilityFinding['migration'] = null;
  if (value.migration !== null) {
    if (!record(value.migration)) return null;
    const migrationId = text(value.migration.id, 256); const migrationStatus = nullableText(value.migration.status, 128);
    if (!migrationId || migrationStatus === undefined) return null;
    migration = { id: migrationId, status: migrationStatus };
  }
  const pullRequest = parsePullRequest(value.pullRequest);
  return id && provider && title && status && filePath && symbol && (value.pullRequest === null || pullRequest) ? { id, provider, title, status, filePath, symbol, migration, pullRequest } : null;
}

function parseIntegration(value: unknown): CompatibilityRepository['integrations'][number] | null {
  if (!record(value)) return null;
  const provider = text(value.provider, 256); const providerName = nullableText(value.providerName, 512); const usageCount = value.usageCount === null ? null : count(value.usageCount);
  const mappedSymbolCount = value.mappedSymbolCount === null ? null : count(value.mappedSymbolCount); const reviewedChangeCount = count(value.reviewedChangeCount);
  const packageName = nullableText(value.packageName, 512); const declaredVersion = nullableText(value.declaredVersion, 256); const resolvedVersion = nullableText(value.resolvedVersion, 256); const versionConfidence = nullableText(value.versionConfidence, 128); const capability = nullableText(value.capability, 256);
  const capabilities = value.capabilities === undefined ? undefined : stringList(value.capabilities, 64);
  if (!provider || typeof value.detected !== 'boolean' || usageCount === undefined || mappedSymbolCount === undefined || reviewedChangeCount === null || providerName === undefined || packageName === undefined || declaredVersion === undefined || resolvedVersion === undefined || versionConfidence === undefined || capability === undefined || (value.capabilities !== undefined && !capabilities)) return null;
  return { provider, providerName: providerName ?? undefined, detected: value.detected, usageCount, mappedSymbolCount, reviewedChangeCount, packageName, declaredVersion, resolvedVersion, versionConfidence, capability, ...(capabilities ? { capabilities } : {}) };
}

function parseScan(value: unknown): CompatibilityRepository['latestCompletedScan'] {
  if (value === null) return null;
  if (!record(value)) return null;
  const id = text(value.id, 256); const sha = nullableText(value.sha, 128); const baselineSha = nullableText(value.baselineSha, 128); const filesAnalyzed = count(value.filesAnalyzed); const findingsCount = count(value.findingsCount); const completedAt = nullableText(value.completedAt, 128);
  return id && sha !== undefined && baselineSha !== undefined && filesAnalyzed !== null && findingsCount !== null && completedAt !== undefined ? { id, sha, baselineSha, filesAnalyzed, findingsCount, completedAt } : null;
}

function parseProofs(value: unknown): CompatibilityRepository['compatibilityProofs'] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 512) return undefined;
  const proofs = value.map((entry) => {
    if (!record(entry)) return null;
    const providerId = text(entry.providerId, 256); const changeId = text(entry.changeId, 256); const status = text(entry.status, 128); const changeTitle = nullableText(entry.changeTitle, 1024); const severity = nullableText(entry.severity, 128);
    const optional = Object.fromEntries(['exactFile', 'matchedModel', 'matchedResource', 'matchedEndpoint', 'matchedDomain', 'matchedParameter', 'matchedResponseField', 'matchedAuthOrHeader', 'officialSourceUrl', 'removalAt'].map((key) => [key, nullableText(entry[key], 2048)]));
    const reasonCodes = entry.reasonCodes === undefined ? undefined : stringList(entry.reasonCodes, 64);
    if (!providerId || !changeId || !status || changeTitle === undefined || severity === undefined || !reasonCodes && entry.reasonCodes !== undefined) return null;
    return { providerId, changeId, status, ...(changeTitle !== null ? { changeTitle } : {}), ...(severity !== null ? { severity } : {}), ...optional, ...(reasonCodes ? { reasonCodes } : {}) };
  });
  return proofs.every(Boolean) ? proofs as CompatibilityRepository['compatibilityProofs'] : undefined;
}

function parseRepository(value: unknown): CompatibilityRepository | null {
  if (!record(value) || !Array.isArray(value.integrations) || !Array.isArray(value.findings)) return null;
  const id = text(value.id, 256); const owner = text(value.owner, 256); const name = text(value.name, 256); const fullName = text(value.fullName, 512); const defaultBranch = text(value.defaultBranch, 256); const latestScanStatus = text(value.latestScanStatus, 128); const latestCompletedScan = parseScan(value.latestCompletedScan);
  const integrations = value.integrations.map(parseIntegration); const findings = value.findings.map(parseFinding); const proofs = parseProofs(value.compatibilityProofs); const openFindingCount = count(value.openFindingCount);
  if (!id || !owner || !name || !fullName || !defaultBranch || !latestScanStatus || !latestCompletedScan && value.latestCompletedScan !== null || typeof value.analysisEvidenceAvailable !== 'boolean' || openFindingCount === null || !integrations.every(Boolean) || !findings.every(Boolean) || proofs === undefined && value.compatibilityProofs !== undefined) return null;
  return { id, owner, name, fullName, defaultBranch, latestScanStatus, latestCompletedScan, analysisEvidenceAvailable: value.analysisEvidenceAvailable, integrations: integrations as CompatibilityRepository['integrations'], openFindingCount, findings: findings as CompatibilityFinding[], ...(proofs ? { compatibilityProofs: proofs } : {}) };
}

function parseCompatibilityMapResponse(value: unknown): CompatibilityMapResponse | null {
  if (!record(value) || !Array.isArray(value.repositories) || value.repositories.length > 512) return null;
  const repositories = value.repositories.map(parseRepository);
  return repositories.every(Boolean) ? { repositories: repositories as CompatibilityRepository[] } : null;
}

function proofStatusVariant(status: string): StatusVariant {
  return status === "AFFECTED" ? "affected" : status === "NOT_AFFECTED" ? "healthy" : "warning";
}

export function CompatibilityMap({ onConnect }: { onConnect?: () => void }) {
  const [repositories, setRepositories] = useState<CompatibilityRepository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const hasRepositories = useRef(false);
  const currentRepo = repositories.find((repository) => repository.id === selectedRepoId) ?? repositories[0];

  const loadMap = useCallback(async (explicitRefresh = false) => {
    const id = ++requestId.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    if (!hasRepositories.current) setLoading(true);
    else if (explicitRefresh) setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/compatibility-map", {
        cache: "no-store",
        signal: nextController.signal,
      });
      if (!response.ok) throw new Error(`Compatibility data could not be loaded (${response.status}).`);
      const payload = parseCompatibilityMapResponse(await response.json());
      if (!payload) throw new Error("Compatibility data returned an invalid response.");
      if (id !== requestId.current) return;
      hasRepositories.current = payload.repositories.length > 0;
      setRepositories(payload.repositories);
      setSelectedRepoId((selected) => payload.repositories.some((repo) => repo.id === selected)
        ? selected
        : payload.repositories[0]?.id ?? "");
    } catch (cause) {
      if (id !== requestId.current || (cause instanceof DOMException && cause.name === "AbortError")) return;
      setError(cause instanceof Error ? cause.message : "Compatibility data could not be loaded.");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadMap();
    return () => {
      requestId.current += 1;
      controller.current?.abort();
    };
  }, [loadMap]);

  if (loading && repositories.length === 0) {
    return <div className="rounded-2xl border border-[#E8E8E5] bg-[#F6F6F4] p-8 text-center text-xs text-[#686868]">
      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-purple-700" />Loading compatibility data…
    </div>;
  }

  if (error && repositories.length === 0) {
    return <div className="rounded-2xl border border-[#F8D7DA] bg-[#FDF2F2] p-6 text-center text-xs text-rose-900">
      <p>{error}</p>
      <button onClick={() => void loadMap(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E8E8E5] bg-white px-3 py-2 font-medium text-[#111111]">
        <RefreshCw className="h-3.5 w-3.5" />Retry
      </button>
    </div>;
  }

  if (repositories.length === 0) {
    return <div className="rounded-2xl border border-[#E8E8E5] bg-[#F6F6F4] p-8 text-center text-xs text-[#686868]">
      <p>Connect a GitHub repository to build your compatibility map.</p>
      {onConnect && <button onClick={onConnect} className="mt-3 rounded-lg bg-[#111111] px-4 py-2 font-medium text-white">Connect repository</button>}
    </div>;
  }

  if (!currentRepo) return null;

  const pullRequests = [...new Map(currentRepo.findings
    .filter((finding) => finding.pullRequest)
    .map((finding) => [finding.pullRequest!.id, finding.pullRequest!])).values()];
  const latestPullRequest = pullRequests.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];
  const repoStatus = currentRepo.latestScanStatus === "failed"
    ? { label: "Latest scan failed", variant: "warning" as const }
    : latestPullRequest
      ? { label: `${getPullRequestStateLabel(latestPullRequest.state)} #${latestPullRequest.number ?? "—"}`, variant: latestPullRequest.state === 'closed' ? "warning" as const : latestPullRequest.state === 'merged' ? "healthy" as const : latestPullRequest.state === 'draft' || latestPullRequest.state === 'open' ? "pr_created" as const : "neutral" as const }
      : currentRepo.openFindingCount > 0
        ? { label: `${currentRepo.openFindingCount} open findings`, variant: "affected" as const }
        : currentRepo.latestCompletedScan
          ? { label: "Scanned", variant: "healthy" as const }
          : { label: "Awaiting first completed scan", variant: "neutral" as const };

  return (
    <div className="space-y-5 rounded-2xl border border-[#E8E8E5] bg-[#F6F6F4] p-5 font-sans text-xs">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E8E8E5] pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <Layers className="h-4 w-4 text-purple-700" />Compatibility topology
          </h3>
          <p className="mt-0.5 text-xs text-[#686868]">Integrations and findings from the latest completed repository scan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {repositories.map((repository) => (
            <button key={repository.id} onClick={() => setSelectedRepoId(repository.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${selectedRepoId === repository.id ? "border-[#111111] bg-white font-semibold text-[#111111]" : "border-[#E8E8E5] bg-white text-[#686868] hover:text-[#111111]"}`}>
              <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-mono text-[11px]">{repository.name}</span>
              {repository.latestScanStatus === "failed"
                ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </button>
          ))}
          <button onClick={() => void loadMap(true)} disabled={refreshing} aria-label="Refresh compatibility map"
            className="rounded-lg border border-[#E8E8E5] bg-white p-2 text-[#686868] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#F8D7DA] bg-[#FDF2F2] px-3 py-2 text-rose-900">Refresh failed: {error}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[#E8E8E5] bg-white p-5 shadow-xs md:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686868]">Selected repository</div>
          <div className="space-y-1">
            <Link href={`/dashboard/repositories/${currentRepo.id}`} className="flex items-center gap-1.5 font-mono text-sm font-semibold text-[#111111] hover:text-purple-700">
              {currentRepo.name}<ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
            <div className="font-mono text-[11px] text-[#686868]">{currentRepo.fullName}</div>
          </div>
          <div className="space-y-2 border-t border-[#E8E8E5] pt-2 text-xs">
            <div className="flex justify-between"><span className="text-[#686868]">Default branch:</span><span className="font-mono text-[#111111]">{currentRepo.defaultBranch}</span></div>
            <div className="flex justify-between"><span className="text-[#686868]">Files analyzed:</span><span className="font-mono text-[#111111]">{currentRepo.latestCompletedScan?.filesAnalyzed ?? "—"}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-[#686868]">Status:</span><StatusPill status={repoStatus.variant} label={repoStatus.label} /></div>
            {currentRepo.latestCompletedScan?.sha && <div className="truncate font-mono text-[10px] text-[#686868]" title={currentRepo.latestCompletedScan.sha}>Baseline {currentRepo.latestCompletedScan.sha}</div>}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#686868]">
            <span>Detected integrations ({currentRepo.integrations.length})</span>
            <span className="text-[11px] font-normal">{currentRepo.latestCompletedScan ? `Scan ${currentRepo.latestCompletedScan.id}` : "No completed scan"}</span>
          </div>

          {!currentRepo.latestCompletedScan ? (
            <p className="rounded-lg border border-[#E8E8E5] bg-white p-4 text-[#686868]">
              {currentRepo.latestScanStatus === "failed" ? "Latest scan failed — review scan status." : "Awaiting first completed scan."}
            </p>
          ) : !currentRepo.analysisEvidenceAvailable ? (
            <p className="rounded-lg border border-[#FDE68A] bg-[#FEF8EC] p-4 text-amber-900">Integration evidence is unavailable for this older scan. Run a fresh scan to build a complete compatibility map.</p>
          ) : currentRepo.integrations.length === 0 ? (
            <p className="rounded-lg border border-[#E8E8E5] bg-white p-4 text-[#686868]">No supported API integrations detected.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {currentRepo.integrations.map((integration) => {
                const reviewed = integration.reviewedChangeCount > 0;
                const providerName = integration.providerName ?? integration.provider.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
                return (
                  <div key={integration.provider} className={`space-y-1 rounded-xl border p-3 ${currentRepo.openFindingCount > 0 && currentRepo.findings.some((finding) => finding.provider === integration.provider && (finding.status === "open" || finding.status === "affected")) ? "border-[#F8D7DA] bg-[#FDF2F2]" : reviewed ? "border-[#C6E1FA] bg-[#EBF3FC]" : "border-[#E8E8E5] bg-white"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#111111]">{providerName}</span>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${reviewed ? "text-blue-600" : "text-zinc-400"}`} />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-[#686868]">
                      <span title={getRegistryCoverageDescription()}>{getRegistryCoverageLabel(integration.reviewedChangeCount)}</span>
                      <span className="font-mono">{integration.usageCount === null ? "Usage count unavailable" : `${integration.usageCount} usages`}</span>
                    </div>
                    <div className="text-[11px] text-[#686868]">
                      {integration.mappedSymbolCount === null ? "Mapping evidence unavailable" : integration.mappedSymbolCount > 0 ? `${integration.mappedSymbolCount} mapped symbols` : "No mapped symbols"}
                    </div>
                    {(integration.resolvedVersion || integration.declaredVersion || integration.capability) && (
                      <div className="border-t border-[#E8E8E5] pt-1 text-[10px] text-[#686868]">
                        <div>{integration.resolvedVersion ?? integration.declaredVersion ?? "Version unavailable"}</div>
                        <div className="font-medium uppercase">{integration.capability ?? "discovery"}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentRepo.latestCompletedScan && currentRepo.analysisEvidenceAvailable && currentRepo.findings.length === 0 && (
            <p className="text-[11px] text-[#686868]">No findings in this completed scan.</p>
          )}
        </div>
      </div>

      {currentRepo.latestCompletedScan && currentRepo.findings.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[#E8E8E5] bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-[#111111]"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Findings and linked migration state</div>
          {currentRepo.findings.map((finding) => (
            <div key={finding.id} className="flex flex-col justify-between gap-2 border-t border-[#E8E8E5] pt-2 sm:flex-row sm:items-center">
              <Link href={`/dashboard/findings/${finding.id}`} className="min-w-0 text-[#111111] hover:text-purple-700">
                <span className="font-medium">{finding.title}</span><span className="ml-2 font-mono text-[10px] text-[#686868]">{finding.filePath} · {finding.symbol}</span>
              </Link>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-[10px] text-[#686868]">
                <span>Finding: {finding.status}</span>
                {finding.migration && <span>Migration: {finding.migration.status ?? "unknown"}</span>}
                {finding.pullRequest && <span>PR: {finding.pullRequest.state ?? "unknown"} #{finding.pullRequest.number ?? "—"}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentRepo.compatibilityProofs && currentRepo.compatibilityProofs.length > 0 && (
        <div className="space-y-3 rounded-xl border border-[#E8E8E5] bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-[#111111]"><ShieldCheck className="h-3.5 w-3.5 text-purple-700" />Repository-bound compatibility proofs</div>
          {currentRepo.compatibilityProofs.map((proof) => (
            <div key={proof.changeId} className="space-y-1 rounded-lg border border-[#E8E8E5] bg-[#F6F6F4] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-[#111111]">{proof.changeTitle ?? proof.changeId}</span><StatusPill status={proofStatusVariant(proof.status)} label={proof.status} /></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#686868]"><span>{proof.providerId}</span>{proof.severity && <span>{proof.severity}</span>}{proof.removalAt && <span>Deadline {proof.removalAt}</span>}{proof.exactFile && <span>{proof.exactFile}:{proof.exactLine ?? "?"}</span>}</div>
              <div className="font-mono text-[10px] text-[#686868]">{getProofMatchedTarget(proof)}</div>
              {proof.reasonCodes && <div className="text-[10px] text-[#686868]">{proof.reasonCodes.join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
