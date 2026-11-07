import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardDataErrorProps {
  message: string;
  onRetry: () => void;
}

export function DashboardDataError({ message, onRetry }: DashboardDataErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
        <p className="text-xs leading-relaxed">{message}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-rose-300 text-rose-900 hover:bg-rose-100">
        Try again
      </Button>
    </div>
  );
}
