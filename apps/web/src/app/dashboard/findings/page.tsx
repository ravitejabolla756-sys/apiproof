"use client";

import { useState } from "react";
import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AlertTriangle,
  Filter,
  Search,
  CheckCircle2,
  FileCode2,
  ArrowRight,
} from "lucide-react";

export default function FindingsConsolePage() {
  const [filterState, setFilterState] = useState<"all" | "open" | "migration_ready">("all");
  const [search, setSearch] = useState("");

  const filteredFindings = demoData.findings.filter((f) => {
    const matchesFilter =
      filterState === "all" ||
      (filterState === "open" && f.severity === "breaking") ||
      (filterState === "migration_ready" && f.pullRequest);
    const matchesSearch =
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.providerId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Breaking Change Findings Console
          </h1>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Verified AST impact findings matched against codebase invocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill status="affected" label="1 Active Finding" pulse />
          <StatusPill status="pr_created" label="Draft PR #1" />
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Search findings by ID, title, provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500">Filter:</span>
          {(["all", "open", "migration_ready"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-md uppercase font-bold text-[10px] border transition-colors ${
                filterState === st
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Incident Console Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Provider</th>
              <th className="py-3 px-4">Finding ID</th>
              <th className="py-3 px-4">Repository</th>
              <th className="py-3 px-4">Affected Source</th>
              <th className="py-3 px-4">Verification</th>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 font-mono text-xs">
            {filteredFindings.map((f) => (
              <tr key={f.id} className="hover:bg-zinc-900/30">
                <td className="py-3.5 px-4">
                  <StatusPill status="affected" label="BREAKING" />
                </td>
                <td className="py-3.5 px-4 font-bold text-zinc-200">{f.providerId}</td>
                <td className="py-3.5 px-4 font-bold text-amber-300">{f.id}</td>
                <td className="py-3.5 px-4 text-zinc-300">{f.repositoryId}</td>
                <td className="py-3.5 px-4 text-emerald-400 font-mono flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" />
                  {f.file}
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 4/4 PASSED
                </td>
                <td className="py-3.5 px-4">
                  <StatusPill status="pr_created" label="Draft PR #1" />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Link
                    href={`/dashboard/findings/${f.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs transition-colors"
                  >
                    View Details <ArrowRight className="w-3 h-3 text-emerald-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
