"use client";

import { WorkRequestItem, WorkRequestParty } from "@/app/types/work.type";
import { formatCurrency, formatDateTime } from "@/app/utils/transactionFormat";
import { WORK_KIND_LABELS, WORK_STATUS_CONFIG, formatScheduleDate } from "@/app/utils/workRequest";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, CalendarX2, Clock, FileSignature, MapPin, UserRound, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkStatusBadge({ status }: { status: string }) {
  const cfg = WORK_STATUS_CONFIG[status] || WORK_STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", cfg.bg, cfg.text, cfg.border)}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

export function WorkKindBadge({ kind }: { kind: WorkRequestItem["kind"] }) {
  const Icon = kind === "booking" ? Zap : FileSignature;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
      <Icon className="size-3" />
      {WORK_KIND_LABELS[kind]}
    </span>
  );
}

export function ScheduleBlock({ item, compact }: { item: Pick<WorkRequestItem, "scheduledDate" | "scheduleLabel">; compact?: boolean }) {
  if (!item.scheduledDate || !item.scheduleLabel) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 text-gray-500", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}>
        <CalendarX2 className="size-4 text-gray-400 shrink-0" />
        <span className="text-xs font-medium">No schedule assigned</span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50/60", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}>
      <div className={cn("rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 text-sky-600", compact ? "size-7" : "size-9")}>
        <CalendarClock className={compact ? "size-3.5" : "size-4"} />
      </div>
      <div className="min-w-0">
        <p className={cn("font-semibold text-gray-900 truncate", compact ? "text-xs" : "text-sm")}>
          {formatScheduleDate(item.scheduledDate, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <p className={cn("text-sky-700 font-medium", compact ? "text-[11px]" : "text-xs")}>{item.scheduleLabel}</p>
      </div>
    </div>
  );
}

function Party({ label, party }: { label: string; party: WorkRequestParty | null }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="size-8 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
        {party?.profile ? <img src={party.profile} alt="" className="w-full h-full object-cover" /> : <UserRound className="size-4 text-sky-600" />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{party?.name || "Unknown"}</p>
      </div>
    </div>
  );
}

export function WorkRequestCard({
  item,
  perspective,
  actions,
}: {
  item: WorkRequestItem;
  perspective: "client" | "provider";
  actions?: React.ReactNode;
}) {
  const cfg = WORK_STATUS_CONFIG[item.status] || WORK_STATUS_CONFIG.pending;
  const counterpart = perspective === "client" ? item.provider : item.client;

  return (
    <article className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200 overflow-hidden flex flex-col">
      <div className={cn("h-1 w-full bg-gradient-to-r", cfg.accent)} />
      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <WorkKindBadge kind={item.kind} />
              {item.category && <span className="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">{item.category}</span>}
            </div>
            <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{item.title || "Work Request"}</h3>
          </div>
          <WorkStatusBadge status={item.status} />
        </div>

        <ScheduleBlock item={item} />

        {item.description && <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>}

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          {item.location && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="size-3.5 text-gray-400 shrink-0" />
              <span className="truncate max-w-[200px]">{item.location}</span>
            </span>
          )}
          {item.budget !== null && item.budget > 0 && (
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3.5 text-gray-400" />
              {formatCurrency(item.budget)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-gray-400" />
            Requested {formatDateTime(item.createdAt)}
          </span>
        </div>

        <div className="mt-auto pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Party label={perspective === "client" ? "Provider" : "Requested by"} party={counterpart} />
          {actions && <div className="flex items-center gap-2 flex-wrap sm:justify-end">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

export function WorkRequestCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="pt-3 border-t border-gray-100 flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
