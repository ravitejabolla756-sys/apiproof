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
    healthy:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    affected:
      "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
    warning:
      "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    neutral: "bg-zinc-800/80 text-zinc-400 border-zinc-700/60",
    reviewed:
      "bg-teal-500/10 text-teal-300 border-teal-500/25 shadow-[0_0_10px_rgba(20,184,166,0.15)]",
    detected: "bg-zinc-800/60 text-zinc-400 border-zinc-700/40",
    verified:
      "bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
    pr_created:
      "bg-cyan-500/10 text-cyan-300 border-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
  };

  const dots: Record<StatusVariant, string> = {
    healthy: "bg-emerald-400",
    affected: "bg-rose-400",
    warning: "bg-amber-400",
    info: "bg-sky-400",
    neutral: "bg-zinc-500",
    reviewed: "bg-teal-400",
    detected: "bg-zinc-500",
    verified: "bg-emerald-400",
    pr_created: "bg-cyan-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border transition-colors ${styles[status]} ${className}`}
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
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800/80 text-xs font-mono">
      <span className="font-semibold text-zinc-200">{name}</span>
      {category && <span className="text-[10px] text-zinc-500">({category})</span>}
      <span
        className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
          status === "reviewed"
            ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
            : "bg-zinc-800 text-zinc-400"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
