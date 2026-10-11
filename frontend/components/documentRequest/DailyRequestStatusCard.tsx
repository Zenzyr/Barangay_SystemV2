import { Skeleton } from "@/components/ui/skeleton";
import { formatBusinessDate, DOCUMENT_NAMES } from "@/app/utils/documentRequestOptions";
import { DailyRequestStatus } from "@/app/types/documentRequest";
import { CalendarCheck2, AlertCircle } from "lucide-react";

export function DailyRequestStatusCard({
  status,
  isLoading,
  isError,
}: {
  status?: DailyRequestStatus;
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-2xl" />;
  }

  if (isError || !status) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <AlertCircle className="size-4 shrink-0 text-slate-400" />
        Today&apos;s request status is unavailable right now.
      </div>
    );
  }

  const today = formatBusinessDate(status.date, status.timeZone);

  return (
    <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold text-emerald-800">
            You can request one of each document type per day.
          </p>
          <p className="text-xs text-emerald-700/80">
            {status.used > 0
              ? `Requested today (${status.used}): ${status.requestedDocuments
                  .map((d) => DOCUMENT_NAMES[d] || d)
                  .join(", ")}`
              : "No documents requested yet today."}
            {` · ${today}`}
          </p>
        </div>
      </div>
    </div>
  );
}