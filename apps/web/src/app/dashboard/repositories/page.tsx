"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  Plus,
  Play,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ConnectRepoModal } from "@/components/dashboard/connect-repo-modal";

interface RepositoryRecord {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
  status: string;
  last_scan_at: string | null;
  created_at: string;
  findings_count: number;
  scans_count: number;
  last_scan_sha: string | null;
}

export default function RepositoriesTablePage() {
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "healthy" | "affected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);

  async function loadRepositories() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repositories");
      const json = await res.json() as { repositories?: RepositoryRecord[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to load repositories.");
      const nextRepositories = json.repositories || [];
      setRepositories(nextRepositories);
      if (nextRepositories.length > 0 && !expandedRepo) {
        setExpandedRepo(nextRepositories[0]!.id);
      }
    } catch (err) {
      console.error("Failed to load repositories:", err);
      setError(err instanceof Error ? err.message : "Unable to load repositories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepositories();
  }, []);

  async function handleTriggerScan(repoId: string) {
    setScanningRepoId(repoId);
    setScanMessage({ id: repoId, text: "Running AST analyzer against repository..." });

    try {
      const res = await fetch(`/api/repositories/${repoId}/scan`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scan execution failed.");
      }

      setScanMessage({
        id: repoId,
        text: `Scan complete: ${data.result.findingsCount} findings recorded.`,
      });
      await loadRepositories();
    } catch (err: unknown) {
      setScanMessage({ id: repoId, text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setScanningRepoId(null);
    }
  }

  const filteredRepos = repositories.filter((repo) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "healthy" && repo.findings_count === 0) ||
      (filter === "affected" && repo.findings_count > 0);
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      <ConnectRepoModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={loadRepositories}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8E5] pb-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111]">
            Repositories
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Repositories connected to the deterministic MY OWL AST compatibility engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={loadRepositories}
            variant="outline"
            size="sm"
            icon={<RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
            className="font-medium"
          >
            Refresh
          </Button>
          <Button
            onClick={() => setIsConnectOpen(true)}
            size="sm"
            icon={<Plus aria-hidden="true" className="w-4 h-4" />}
            className="font-medium"
          >
            Connect repository
          </Button>
        </div>
      </div>

      {error && <DashboardDataError message={error} onRetry={() => void loadRepositories()} />}

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search aria-hidden="true" className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            aria-label="Search repositories"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Filter repositories by health">
          <span className="text-[#686868] mr-1">Filter:</span>
          {(["all", "healthy", "affected"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                filter === f
                  ? "bg-white text-[#111111] border-[#111111] shadow-2xs"
                  : "bg-transparent text-[#686868] border-transparent hover:text-[#111111]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Repositories Table */}
      <div className="rounded-[24px] border border-[#E8E8E5] bg-white overflow-hidden shadow-xs">
        <div
          role="region"
          aria-label="Repositories table"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset"
        >
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F6F6F4] border-b border-[#E8E8E5] text-[#686868] text-[10px] font-semibold uppercase tracking-wider">
                <th scope="col" className="py-3 px-4 w-10"><span className="sr-only">Repository type</span></th>
                <th scope="col" className="py-3 px-4">Repository</th>
                <th scope="col" className="py-3 px-4">Branch</th>
                <th scope="col" className="py-3 px-4 text-center">Scans</th>
                <th scope="col" className="py-3 px-4 text-center">Findings</th>
                <th scope="col" className="py-3 px-4">Last Analyzed</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E5] text-xs">
              {error ? null : loading ? (
                <tr>
                  <td colSpan={8} role="status" aria-live="polite" aria-atomic="true" className="py-12 text-center text-[#686868]">
                    <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-700" />
                    <span>Loading repositories from database...</span>
                  </td>
                </tr>
              ) : filteredRepos.length === 0 ? (
                <tr>
                  <td colSpan={8} role="status" aria-live="polite" aria-atomic="true" className="py-12 text-center text-[#686868]">
                    No repositories found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredRepos.map((repo) => {
                  const isExpanded = expandedRepo === repo.id;
                  const isScanning = scanningRepoId === repo.id;

                  return (
                    <tr key={repo.id} className="group hover:bg-[#F6F6F4]/50 transition-colors">
                      <td colSpan={8} className="p-0">
                        {/* Main Table Row */}
                        <div className="flex items-center justify-between py-3.5 px-4">
                          <div className="w-10">
                            <button
                              type="button"
                              onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${repo.name}`}
                              aria-expanded={isExpanded}
                              className="p-1 rounded-lg text-zinc-400 hover:text-[#111111] hover:bg-zinc-100"
                            >
                              {isExpanded ? (
                                <ChevronDown aria-hidden="true" className="w-4 h-4 text-purple-700" />
                              ) : (
                                <ChevronRight aria-hidden="true" className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <div className="flex-1 font-medium text-[#111111] flex items-center gap-2">
                            <GitBranch aria-hidden="true" className="w-4 h-4 text-zinc-400" />
                            <Link href={`/dashboard/repositories/${repo.id}`} className="font-mono text-xs hover:underline">
                              {repo.name}
                            </Link>
                            <span className="text-[11px] text-[#686868] font-mono hidden md:inline">({repo.full_name})</span>
                          </div>

                          <div className="w-28 text-[#686868] font-mono">
                            {repo.default_branch}
                          </div>

                          <div className="w-20 text-center font-mono font-medium text-[#111111]">
                            {repo.scans_count}
                          </div>

                          <div className="w-20 text-center font-mono font-medium">
                            {repo.findings_count > 0 ? (
                              <span className="text-rose-700 font-semibold">{repo.findings_count}</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">0</span>
                            )}
                          </div>

                          <div className="w-32 text-[#686868] text-[11px]">
                            {repo.last_scan_at ? new Date(repo.last_scan_at).toLocaleDateString() : 'Never'}
                          </div>

                          <div className="w-32">
                            <StatusPill
                              status={repo.findings_count > 0 ? "affected" : "healthy"}
                              label={repo.findings_count > 0 ? `${repo.findings_count} findings` : "Healthy"}
                            />
                          </div>

                          <div className="w-40 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isScanning}
                              onClick={() => handleTriggerScan(repo.id)}
                              className="text-xs gap-1 font-medium"
                            >
                              {isScanning ? (
                                <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin text-purple-700" />
                              ) : (
                                <Play aria-hidden="true" className="w-3 h-3 text-purple-700" />
                              )}
                              <span>{isScanning ? "Scanning..." : "Scan"}</span>
                            </Button>

                            <Link
                              href={`/dashboard/repositories/${repo.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                            >
                              Inspect <ExternalLink aria-hidden="true" className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>

                        {/* Scan Status Toast if active for this repo */}
                        {scanMessage && scanMessage.id === repo.id && (
                          <div role="status" aria-live="polite" aria-atomic="true" className={`px-5 py-2 text-xs border-t ${
                            scanMessage.error
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-purple-50 text-purple-900 border-purple-200"
                          }`}>
                            {scanMessage.text}
                          </div>
                        )}

                        {/* Expanded Row Detail Drawer */}
                        {isExpanded && (
                          <div className="bg-[#F6F6F4] p-5 border-t border-[#E8E8E5] space-y-4 text-xs">
                            <div className="text-xs font-semibold text-[#111111] flex items-center justify-between">
                              <span>Repository metadata: {repo.full_name}</span>
                              <span className="font-mono text-[11px] text-[#686868]">ID: {repo.id}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                              <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                                <span className="text-[#686868] block text-[10px] uppercase font-semibold">GitHub Repo ID</span>
                                <span className="text-[#111111] font-mono font-semibold">{repo.github_repository_id}</span>
                              </div>
                              <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                                <span className="text-[#686868] block text-[10px] uppercase font-semibold">Completed Scans</span>
                                <span className="text-purple-700 font-mono font-semibold">{repo.scans_count} scans</span>
                              </div>
                              <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                                <span className="text-[#686868] block text-[10px] uppercase font-semibold">Breaking Findings</span>
                                <span className="text-rose-700 font-mono font-semibold">{repo.findings_count} active</span>
                              </div>
                              <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                                <span className="text-[#686868] block text-[10px] uppercase font-semibold">Last Analyzed SHA</span>
                                <span className="text-[#111111] font-mono text-[11px] truncate block">
                                  {repo.last_scan_sha ? repo.last_scan_sha.slice(0, 10) : 'None'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
