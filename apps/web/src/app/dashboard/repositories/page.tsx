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
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      <ConnectRepoModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8E5] pb-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111]">
            Repositories
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Repositories currently analyzed by APIProof AST compatibility engine.
          </p>
        </div>

        <Button
          onClick={() => setIsConnectOpen(true)}
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          className="font-medium"
        >
          Connect repository
        </Button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[#686868] mr-1">Filter:</span>
          {(["all", "healthy", "affected"] as const).map((f) => (
            <button
              key={f}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F6F6F4] border-b border-[#E8E8E5] text-[#686868] text-[10px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-10" />
                <th className="py-3 px-4">Repository</th>
                <th className="py-3 px-4">Providers</th>
                <th className="py-3 px-4">Coverage</th>
                <th className="py-3 px-4 text-center">Findings</th>
                <th className="py-3 px-4">Last analyzed</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E5] text-xs">
              {filteredRepos.map((repo) => {
                const isExpanded = expandedRepo === repo.id;

                return (
                  <tr key={repo.id} className="group hover:bg-[#F6F6F4]/50 transition-colors">
                    <td colSpan={8} className="p-0">
                      {/* Main Table Row */}
                      <div className="flex items-center justify-between py-3.5 px-4">
                        <div className="w-10">
                          <button
                            onClick={() => setExpandedRepo(isExpanded ? null : repo.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-[#111111] hover:bg-zinc-100"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-purple-700" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 font-medium text-[#111111] flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-zinc-400" />
                          <span className="font-mono text-xs">{repo.name}</span>
                          <span className="text-[11px] text-[#686868] font-mono hidden md:inline">({repo.fullName})</span>
                        </div>

                        <div className="w-36 text-[#686868]">
                          {repo.providers[0]}
                          {repo.providers.length > 1 && ` +${repo.providers.length - 1}`}
                        </div>

                        <div className="w-36 text-[#686868]">
                          {repo.providers.includes("Twilio") ? "Reviewed: Twilio" : repo.providers.includes("Stripe") ? "Reviewed: Stripe" : "Detected"}
                        </div>

                        <div className="w-20 text-center font-mono font-medium">
                          {repo.findingsCount > 0 ? (
                            <span className="text-rose-700 font-semibold">{repo.findingsCount}</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">0</span>
                          )}
                        </div>

                        <div className="w-28 text-[#686868] text-[11px]">
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
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>

                      {/* Expanded Row Detail Drawer */}
                      {isExpanded && (
                        <div className="bg-[#F6F6F4] p-5 border-t border-[#E8E8E5] space-y-4 text-xs">
                          <div className="text-xs font-semibold text-[#111111]">
                            Repository details: {repo.name}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                              <span className="text-[#686868] block text-[10px] uppercase font-semibold">Source files</span>
                              <span className="text-[#111111] font-mono font-semibold">{repo.totalFiles} files</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                              <span className="text-[#686868] block text-[10px] uppercase font-semibold">Usages indexed</span>
                              <span className="text-purple-700 font-mono font-semibold">{repo.usagesCount} locations</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                              <span className="text-[#686868] block text-[10px] uppercase font-semibold">Reviewed coverage</span>
                              <span className="text-[#111111] font-medium">
                                {repo.providers.filter((p) => p === "Stripe" || p === "Twilio").join(", ") || "None"}
                              </span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-[#E8E8E5] space-y-1">
                              <span className="text-[#686868] block text-[10px] uppercase font-semibold">Findings</span>
                              <span className="text-[#111111] font-mono font-semibold">{repo.findingsCount} active</span>
                            </div>
                          </div>

                          <div className="text-xs text-[#686868] pt-1">
                            Detected SDKs:{" "}
                            {repo.providers.map((p) => (
                              <span key={p} className="inline-block mr-1.5 text-[#111111] font-mono text-[11px] bg-white px-2.5 py-0.5 rounded-lg border border-[#E8E8E5]">
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
