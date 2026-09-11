import { demoData } from "@/lib/demo-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  Search,
  Layers,
  Terminal,
} from "lucide-react";

export default function ActivityPage() {
  const getIcon = (type: string) => {
    switch (type) {
      case "SCAN_COMPLETED":
        return <Search className="w-4 h-4 text-blue-400" />;
      case "USAGE_DETECTED":
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case "FINDING_CREATED":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "MIGRATION_VERIFIED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "PR_CREATED":
        return <GitPullRequest className="w-4 h-4 text-blue-400" />;
      default:
        return <Terminal className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Activity Log
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Chronological audit timeline of engine scans, AST indexing, verification, and draft PR events
        </p>
      </div>

      {/* Audit Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
            System Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-zinc-800">
            {demoData.activityEvents.map((event) => (
              <div key={event.id} className="relative flex items-start gap-4 text-xs">
                {/* Dot / Icon */}
                <div className="absolute -left-6 top-0.5 p-1 rounded-full bg-zinc-900 border border-zinc-700">
                  {getIcon(event.type)}
                </div>

                <div className="flex-1 bg-zinc-950/80 p-3.5 rounded border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-200 font-mono">
                        {event.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
                        {event.repositoryId}
                      </Badge>
                    </div>
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(event.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-zinc-400 font-sans text-xs">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
