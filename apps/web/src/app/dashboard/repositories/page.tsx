"use client";

import { useState } from "react";
import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
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
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      <ConnectRepoModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Repositories
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Repositories currently analyzed by APIProof.
          </p>
        </div>

        <Button
          onClick={() => setIsConnectOpen(true)}
          size="sm"
          icon={<Plus className="w-4 h-4" />}
        >
          Connect repository
        </Button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 mr-1">Filter:</span>
          {(["all", "healthy", "affected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize border transition-colors ${
                filter === f
                  ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Repositories Table */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800/80 text-zinc-400 text-[11px] font-medium">
                <th className="py-2.5 px-3 w-8" />
                <th className="py-2.5 px-3 font-medium">Repository</th>
                <th className="py-2.5 px-3 font-medium">Providers</th>
                <th className="py-2.5 px-3 font-medium">Coverage</th>
                <th className="py-2.5 px-3 font-medium text-center">Findings</th>
                <th className="py-2.5 px-3 font-medium">Last analyzed</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filteredRepos.map((repo) => {
                const isExpanded = expandedRepo === repo.id;

                return (
                  <tr key={repo.id} className="group hover:bg-zinc-900/50 transition-colors">
                    <td colSpan={8} className="p-0">
                      {/* Main Table Row */}
                      <div className="flex items-center justify-between py-3 px-3">
                        <div className="w-8">
                          <button
                            onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 font-medium text-zinc-100 flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="font-mono text-xs">{repo.name}</span>
                          <span className="text-[11px] text-zinc-500 font-mono hidden md:inline">({repo.fullName})</span>
                        </div>

                        <div className="w-36 text-zinc-300">
                          {repo.providers[0]}
                          {repo.providers.length > 1 && ` +${repo.providers.length - 1}`}
                        </div>

                        <div className="w-36 text-zinc-400">
                          {repo.providers.includes("Twilio") ? "Reviewed: Twilio" : repo.providers.includes("Stripe") ? "Reviewed: Stripe" : "Detected"}
                        </div>

                        <div className="w-20 text-center font-mono font-medium">
                          {repo.findingsCount > 0 ? (
                            <span className="text-amber-400">{repo.findingsCount}</span>
                          ) : (
                            <span className="text-zinc-500">0</span>
                          )}
                        </div>

                        <div className="w-28 text-zinc-400 text-[11px]">
                          Sep 11
                        </div>

                        <div className="w-32">
                          <StatusPill
                            status={repo.status === "healthy" ? "healthy" : "affected"}
                            label={repo.status === "healthy" ? "Healthy" : "Needs review"}
                          />
                        </div>

                        <div className="w-20 text-right">
                          <Link
                            href={`/dashboard/repositories/${repo.id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                          >
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>

                      {/* Expanded Row Detail Drawer */}
                      {isExpanded && (
                        <div className="bg-zinc-950/80 p-4 border-t border-zinc-800/80 space-y-3 text-xs">
                          <div className="text-xs font-semibold text-zinc-300">
                            Repository details: {repo.name}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block text-[11px]">Source files</span>
                              <span className="text-zinc-200 font-mono font-semibold">{repo.totalFiles} files</span>
                            </div>
                            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block text-[11px]">Usages indexed</span>
                              <span className="text-blue-400 font-mono font-semibold">{repo.usagesCount} locations</span>
                            </div>
                            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block text-[11px]">Reviewed coverage</span>
                              <span className="text-zinc-200 font-medium">
                                {repo.providers.filter((p) => p === "Stripe" || p === "Twilio").join(", ") || "None"}
                              </span>
                            </div>
                            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block text-[11px]">Findings</span>
                              <span className="text-zinc-200 font-mono font-semibold">{repo.findingsCount} active</span>
                            </div>
                          </div>

                          <div className="text-xs text-zinc-400 pt-1">
                            Detected SDKs:{" "}
                            {repo.providers.map((p) => (
                              <span key={p} className="inline-block mr-1.5 text-zinc-300 font-mono text-[11px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
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
