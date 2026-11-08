import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardDataErrorProps {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}

export function DashboardDataError({ message, onRetry, busy = false }: DashboardDataErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="flex flex-col gap-3 rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
        <p className="text-xs leading-relaxed">{message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy} aria-busy={busy ? 'true' : undefined} className="min-h-11 shrink-0 border-rose-300 text-rose-900 hover:bg-rose-100">
        Try again
      </Button>
    </div>
  );
}
