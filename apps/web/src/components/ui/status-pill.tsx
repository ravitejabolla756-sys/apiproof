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
    healthy: "bg-[#EEF7F2] text-emerald-800 border-[#D1EBE0]",
    affected: "bg-[#FDF2F2] text-rose-800 border-[#F8D7DA]",
    warning: "bg-[#FEF8EC] text-amber-800 border-[#FDE68A]",
    info: "bg-[#EBF3FC] text-blue-800 border-[#C6E1FA]",
    neutral: "bg-[#F4F4F2] text-zinc-700 border-[#E8E8E5]",
    reviewed: "bg-[#EBF3FC] text-blue-800 border-[#C6E1FA]",
    detected: "bg-[#F4F4F2] text-zinc-600 border-[#E8E8E5]",
    verified: "bg-[#EEF7F2] text-emerald-800 border-[#D1EBE0]",
    pr_created: "bg-[#EBF3FC] text-blue-800 border-[#C6E1FA]",
  };

  const dots: Record<StatusVariant, string> = {
    healthy: "bg-emerald-500",
    affected: "bg-rose-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
    neutral: "bg-zinc-400",
    reviewed: "bg-blue-500",
    detected: "bg-zinc-400",
    verified: "bg-emerald-500",
    pr_created: "bg-blue-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium border transition-colors ${styles[status]} ${className}`}
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
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#E8E8E5] text-xs font-sans shadow-2xs">
      <span className="font-medium text-[#111111]">{name}</span>
      {category && <span className="text-[10px] text-zinc-400">({category})</span>}
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          status === "reviewed"
            ? "bg-[#EBF3FC] text-blue-800 border border-[#C6E1FA]"
            : "bg-[#F4F4F2] text-zinc-600 border border-[#E8E8E5]"
        }`}
      >
        {status === "reviewed" ? "Reviewed" : "Detected"}
      </span>
    </div>
  );
}
