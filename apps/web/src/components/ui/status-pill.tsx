import type { ReactNode } from "react";

export type StatusVariant =
  | "healthy"
  | "affected"
  | "warning"
  | "info"
  | "neutral"
  | "reviewed"
  | "detected"
  | "verified"
  | "pr_created";

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
  children?: ReactNode;
  pulse?: boolean;
  className?: string;
}

export function StatusPill({
  status,
  label,
  children,
  pulse = false,
  className = "",
}: StatusPillProps) {
  const styles: Record<StatusVariant, string> = {
    healthy: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
    affected: "bg-rose-950/40 text-rose-300 border-rose-800/50",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800/50",
    info: "bg-blue-950/40 text-blue-300 border-blue-800/50",
    neutral: "bg-zinc-900 text-zinc-400 border-zinc-800",
    reviewed: "bg-blue-950/30 text-blue-300 border-blue-800/40",
    detected: "bg-zinc-900 text-zinc-400 border-zinc-800",
    verified: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
    pr_created: "bg-blue-950/40 text-blue-300 border-blue-800/50",
  };

  const dots: Record<StatusVariant, string> = {
    healthy: "bg-emerald-400",
    affected: "bg-rose-400",
    warning: "bg-amber-400",
    info: "bg-blue-400",
    neutral: "bg-zinc-500",
    reviewed: "bg-blue-400",
    detected: "bg-zinc-500",
    verified: "bg-emerald-400",
    pr_created: "bg-blue-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-sans font-medium border transition-colors ${styles[status]} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dots[status]}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dots[status]}`}
        />
      </span>
      {label || children}
    </span>
  );
}

export function ProviderBadge({
  name,
  status = "detected",
  category,
}: {
  name: string;
  status?: "reviewed" | "detected";
  category?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-sans">
      <span className="font-medium text-zinc-200">{name}</span>
      {category && <span className="text-[10px] text-zinc-500">({category})</span>}
      <span
        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
          status === "reviewed"
            ? "bg-blue-950/50 text-blue-300 border border-blue-800/50"
            : "bg-zinc-800 text-zinc-400"
        }`}
      >
        {status === "reviewed" ? "Reviewed" : "Detected"}
      </span>
    </div>
  );
}
