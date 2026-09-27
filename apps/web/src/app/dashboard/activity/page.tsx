"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  repo_name: string | null;
  repo_full_name: string | null;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadActivity() {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const json = await res.json();
        setActivities(json.activities || []);
      }
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-700" />
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
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="font-medium text-xs"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#686868]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          <span>Loading activity log...</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8E5] rounded-[28px] space-y-2">
          <Activity className="w-8 h-8 text-purple-700 mx-auto" />
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
                      {act.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#686868] leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="text-right text-[11px] text-[#686868] font-mono shrink-0">
                  {new Date(act.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
