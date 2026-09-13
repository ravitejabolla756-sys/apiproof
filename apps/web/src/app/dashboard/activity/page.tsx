"use client";

import { useState } from "react";
import { demoData } from "@/lib/demo-data";
import { EventTimeline } from "@/components/ui/event-timeline";
import { Search } from "lucide-react";

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
    <div className="space-y-6 max-w-5xl font-sans text-xs">
      {/* Header Bar */}
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Activity
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Engineering event log of scans, symbol checks, and draft pull request updates.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search activity events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 mr-1">Event type:</span>
          {(["all", "scan", "finding", "pr"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize border transition-colors ${
                filterType === t
                  ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800/80">
        <EventTimeline events={filteredEvents} />
      </div>
    </div>
  );
}
