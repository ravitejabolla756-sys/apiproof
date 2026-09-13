import {
  Search,
  Layers,
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  Terminal,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";

export interface EventItem {
  id: string;
  type: string;
  title: string;
  description: string;
  repositoryId: string;
  timestamp: string;
  badge?: string;
}

export function EventTimeline({ events }: { events: EventItem[] }) {
  const getIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "SCAN_COMPLETED":
        return <Search className="w-3.5 h-3.5 text-sky-400" />;
      case "INVENTORY_INDEXED":
      case "USAGE_DETECTED":
        return <Layers className="w-3.5 h-3.5 text-teal-400" />;
      case "FINDING_DETECTED":
      case "FINDING_CREATED":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case "MIGRATION_VERIFIED":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "PR_CREATED":
        return <GitPullRequest className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="relative pl-6 space-y-4 font-mono text-xs before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-zinc-800/80">
      {events.map((event) => (
        <div key={event.id} className="relative flex items-start gap-3 group">
          {/* Timeline Dot Icon */}
          <div className="absolute -left-6 top-1 p-1 rounded-full bg-zinc-950 border border-zinc-700/80 shadow-sm">
            {getIcon(event.type)}
          </div>

          <div className="flex-1 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-200">{event.title}</span>
                <StatusPill status="neutral" label={event.repositoryId} />
              </div>
              <span className="text-[10px] text-zinc-500">{event.timestamp}</span>
            </div>
            <p className="text-zinc-400 font-sans text-xs leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
