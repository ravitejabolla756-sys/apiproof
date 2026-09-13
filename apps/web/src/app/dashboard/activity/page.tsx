"use client";

import { useState } from "react";
import { demoData } from "@/lib/demo-data";
import { EventTimeline } from "@/components/ui/event-timeline";
import { Activity, Filter, Search } from "lucide-react";

export default function ActivityTimelinePage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredEvents = demoData.activityEvents.filter((e) => {
    const matchesType =
      filterType === "all" || e.type.toLowerCase().includes(filterType.toLowerCase());
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.repositoryId.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-5xl font-mono text-xs">
      {/* Header Bar */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Engineering Event Timeline
        </h1>
        <p className="text-xs text-zinc-400 font-sans mt-1">
          Chronological audit event stream of scans, AST symbol tracing, verification, and draft PR events
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Search activity events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500">Event Type:</span>
          {(["all", "scan", "finding", "pr"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md uppercase font-bold text-[10px] border transition-colors ${
                filterType === t
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 shadow-xl">
        <EventTimeline events={filteredEvents} />
      </div>
    </div>
  );
}
