"use client";

import { useState } from "react";
import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Search, CheckCircle2, ArrowRight } from "lucide-react";

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
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Findings
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Verified API change impacts requiring engineering review.
          </p>
        </div>

        <StatusPill status="affected" label="1 finding needs review" />
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 mr-1">Filter:</span>
          {(["all", "open", "migration_ready"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize border transition-colors ${
                filterState === st
                  ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Findings Table */}
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800/80 text-zinc-400 text-[11px] font-medium">
              <th className="py-2.5 px-4 font-medium">Severity</th>
              <th className="py-2.5 px-4 font-medium">Provider</th>
              <th className="py-2.5 px-4 font-medium">Finding</th>
              <th className="py-2.5 px-4 font-medium">Repository</th>
              <th className="py-2.5 px-4 font-medium">Affected code</th>
              <th className="py-2.5 px-4 font-medium">Verification</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-xs">
            {filteredFindings.map((f) => (
              <tr key={f.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="py-3 px-4">
                  <StatusPill status="affected" label="Breaking" />
                </td>
                <td className="py-3 px-4 font-semibold text-zinc-100">{f.providerId}</td>
                <td className="py-3 px-4 font-mono text-zinc-300 text-[11px]">{f.id}</td>
                <td className="py-3 px-4 font-mono text-zinc-300 text-[11px]">{f.repositoryId}</td>
                <td className="py-3 px-4 font-mono text-zinc-300 text-[11px]">
                  {f.file}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 4/4 passed
                </td>
                <td className="py-3 px-4">
                  <StatusPill status="pr_created" label="Draft PR #1" />
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/dashboard/findings/${f.id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Review <ArrowRight className="w-3 h-3" />
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
