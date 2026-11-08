"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardDataError } from "@/components/dashboard/data-state";
import { formatActivityTimestamp, getActivityTypeLabel, type ActivityItem } from "@/lib/activity-utils";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActivity() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activity");
      const json = await res.json() as { activities?: ActivityItem[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to load activity.");
      setActivities(json.activities || []);
    } catch (err) {
      console.error("Failed to load activity:", err);
      setError(err instanceof Error ? err.message : "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  return (
    <div aria-busy={loading ? 'true' : undefined} className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <Activity aria-hidden="true" className="w-6 h-6 text-purple-700" />
            Workspace Audit Activity Log
          </h1>
          <p className="text-xs text-[#686868] mt-1">
            Complete chronological record of repository scans, indexings, findings, and pull requests.
          </p>
        </div>

        <Button
          onClick={loadActivity}
          variant="outline"
          size="sm"
          icon={<RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />}
          className="min-h-11 font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {error && <DashboardDataError message={error} onRetry={() => void loadActivity()} />}

      {error ? null : loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="py-20 text-center text-[#686868]">
          <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading activity log...</span>
        </div>
      ) : activities.length === 0 ? (
        <div role="status" aria-live="polite" aria-atomic="true" className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-2">
          <Activity aria-hidden="true" className="w-8 h-8 text-purple-700 mx-auto" />
          <p className="font-semibold text-base text-[#111111]">No activity recorded yet</p>
          <p className="text-xs text-[#686868]">
            Activity events will appear here as you connect repositories, run AST scans, and propose migrations.
          </p>
        </div>
      ) : (
        <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
          <div className="divide-y divide-[#E8E8E5]">
            {activities.map((act) => (
              <div key={act.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#111111]">{act.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F6F6F4] text-zinc-700 border border-[#E8E8E5] text-[10px] font-medium uppercase font-mono">
                      {getActivityTypeLabel(act.type, act.title)}
                    </span>
                  </div>
                  <p className="text-xs text-[#686868] leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="text-right text-[11px] text-[#686868] font-mono shrink-0">
                  {formatActivityTimestamp(act.created_at ?? act.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
