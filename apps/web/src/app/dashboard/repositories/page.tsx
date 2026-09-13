"use client";

import { useState } from "react";
import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Plus,
} from "lucide-react";
import { ConnectRepoModal } from "@/components/dashboard/connect-repo-modal";

export default function RepositoriesTablePage() {
  const [filter, setFilter] = useState<"all" | "healthy" | "affected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRepo, setExpandedRepo] = useState<string | null>("bavio-ai-v1");
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const filteredRepos = demoData.repositories.filter((repo) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "healthy" && repo.status === "healthy") ||
      (filter === "affected" && repo.status !== "healthy");
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      <ConnectRepoModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
            Connected Repositories
          </h1>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Monitored repositories scanned read-only for AST API/SDK symbol usage
          </p>
        </div>

        <button
          onClick={() => setIsConnectOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Repository
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Search repositories by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500">Filter:</span>
          {(["all", "healthy", "affected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md uppercase font-bold text-[10px] border transition-colors ${
                filter === f
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Developer Console Repository Intelligence Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <th className="py-3 px-4 w-10" />
                <th className="py-3 px-4">Repository</th>
                <th className="py-3 px-4">Health Status</th>
                <th className="py-3 px-4">Integrations</th>
                <th className="py-3 px-4 text-center">Usages</th>
                <th className="py-3 px-4">Reviewed Coverage</th>
                <th className="py-3 px-4 text-center">Findings</th>
                <th className="py-3 px-4">Last Scan</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 font-mono text-xs">
              {filteredRepos.map((repo) => {
                const isExpanded = expandedRepo === repo.id;

                return (
                  <tr key={repo.id} className="group hover:bg-zinc-900/30 transition-colors">
                    <td colSpan={9} className="p-0">
                      {/* Main Table Row */}
                      <div className="flex items-center justify-between py-3.5 px-4">
                        <div className="w-10">
                          <button
                            onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 font-semibold text-zinc-100 flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{repo.name}</span>
                          <span className="text-[10px] text-zinc-500 font-sans">({repo.fullName})</span>
                        </div>

                        <div className="w-44">
                          <StatusPill
                            status={repo.status === "healthy" ? "healthy" : "pr_created"}
                            label={repo.statusLabel}
                          />
                        </div>

                        <div className="w-36 text-zinc-300">
                          {repo.providers.slice(0, 3).join(", ")}
                          {repo.providers.length > 3 && ` +${repo.providers.length - 3}`}
                        </div>

                        <div className="w-20 text-center font-bold text-zinc-200">
                          {repo.usagesCount}
                        </div>

                        <div className="w-40 text-teal-300 font-medium">
                          {repo.providers.includes("Twilio") || repo.providers.includes("Stripe")
                            ? "Twilio / Stripe Reviewed"
                            : "Detected Only"}
                        </div>

                        <div className="w-20 text-center">
                          {repo.findingsCount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                              {repo.findingsCount}
                            </span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </div>

                        <div className="w-32 text-zinc-400 text-[11px]">
                          {new Date(repo.lastScanAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>

                        <div className="w-24 text-right">
                          <Link
                            href={`/dashboard/repositories/${repo.id}`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                          >
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>

                      {/* Expanded Row Detail Drawer */}
                      {isExpanded && (
                        <div className="bg-zinc-900/60 p-4 border-t border-zinc-800 space-y-3 font-sans text-xs">
                          <div className="font-mono text-xs font-bold text-zinc-300 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Repository Intelligence Summary: {repo.name}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 font-mono space-y-1">
                              <span className="text-zinc-500 block">Total Files Analyzed</span>
                              <span className="text-zinc-200 font-bold text-sm">{repo.totalFiles} source files</span>
                            </div>
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 font-mono space-y-1">
                              <span className="text-zinc-500 block">Indexed AST Usages</span>
                              <span className="text-emerald-400 font-bold text-sm">{repo.usagesCount} locations</span>
                            </div>
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 font-mono space-y-1">
                              <span className="text-zinc-500 block">Reviewed Coverage</span>
                              <span className="text-teal-300 font-bold text-sm">
                                {repo.providers.filter((p) => p === "Stripe" || p === "Twilio").join(", ") || "None"}
                              </span>
                            </div>
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 font-mono space-y-1">
                              <span className="text-zinc-500 block">Active Risks</span>
                              <span className="text-zinc-200 font-bold text-sm">{repo.findingsCount} findings</span>
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400 pt-1">
                            Detected SDKs:{" "}
                            {repo.providers.map((p) => (
                              <span key={p} className="inline-block mr-2 text-zinc-200 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
