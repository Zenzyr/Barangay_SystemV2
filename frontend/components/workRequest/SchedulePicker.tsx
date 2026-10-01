"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { DayAvailability, SlotAvailability } from "@/app/types/work.type";
import { workScheduleSettings } from "@/app/types/barangaySettings.type";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { WEEKDAY_LABELS, bookableDates } from "@/app/utils/workRequest";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Ban, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function useWorkScheduleConfig(enabled = true) {
  return useQuery<workScheduleSettings>({
    queryKey: ["work-schedule", "config"],
    queryFn: async () => (await axiosInstance.get("/work/schedule/config")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useSlotAvailability(providerId: string | null | undefined, date: string | null | undefined, enabled = true) {
  return useQuery<DayAvailability>({
    queryKey: ["work-schedule", "availability", providerId, date],
    queryFn: async () => (await axiosInstance.get("/work/schedule/availability", { params: { provider: providerId, date } })).data,
    enabled: enabled && !!providerId && !!date,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function DatePickerGrid({
  config,
  value,
  onChange,
}: {
  config: workScheduleSettings | undefined;
  value: string | null;
  onChange: (date: string) => void;
}) {
  const dates = useMemo(() => bookableDates(config), [config]);

  if (!config) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (dates.length === 0) {
    return <p className="text-sm text-gray-500">No dates are open for work requests right now.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <CalendarDays className="size-3.5" />
        Open {config.workingDays.map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(", ")} · up to {config.bookingWindowDays} days ahead
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
        {dates.map((d) => {
          const date = new Date(`${d}T00:00:00`);
          const selected = value === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-all",
                selected
                  ? "border-sky-400 bg-gradient-to-br from-sky-50 to-emerald-50 ring-2 ring-sky-200 shadow-sm"
                  : "border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/40",
              )}
            >
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider", selected ? "text-sky-700" : "text-gray-400")}>
                {date.toLocaleDateString("en-PH", { weekday: "short" })}
              </p>
              <p className={cn("text-lg font-bold leading-tight", selected ? "text-sky-800" : "text-gray-800")}>{date.getDate()}</p>
              <p className="text-[10px] text-gray-500">{date.toLocaleDateString("en-PH", { month: "short", year: "numeric" })}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function slotStatusLabel(slot: SlotAvailability) {
  if (slot.status === "past") return "Already started";
  if (slot.status === "full") return "Fully booked";
  return slot.capacity > 1 ? `Available · ${slot.remaining} of ${slot.capacity} left` : "Available";
}

export function TimeSlotGrid({
  providerId,
  date,
  value,
  onChange,
  currentSlot,
}: {
  providerId: string | null | undefined;
  date: string | null;
  value: string | null;
  onChange: (startTime: string, slot: SlotAvailability) => void;
  currentSlot?: { date: string | null; startTime: string | null };
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useSlotAvailability(providerId, date);

  if (!date) {
    return <p className="text-sm text-gray-400">Select a date to see available time slots.</p>;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <AlertTriangle className="size-5 text-rose-500" />
        <p className="text-sm text-gray-600">{apiErrorMessage(error, "Time slots could not be loaded.")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 border-gray-200">
          <RotateCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!data.open) {
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{data.closedReason}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Availability updates automatically.</p>
        <button type="button" onClick={() => refetch()} className="text-xs text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
          <RotateCw className={cn("size-3", isFetching && "animate-spin")} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.slots.map((slot) => {
          const isCurrent = currentSlot?.date === date && currentSlot?.startTime === slot.startTime;
          const available = slot.status === "available" && !isCurrent;
          const selected = value === slot.startTime && available;
          const Icon = slot.status === "available" ? (selected ? CheckCircle2 : Clock) : Ban;
          return (
            <button
              key={slot.startTime}
              type="button"
              disabled={!available}
              aria-pressed={selected}
              onClick={() => onChange(slot.startTime, slot)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all",
                selected && "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200",
                !selected && available && "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40",
                !available && "border-dashed border-gray-200 bg-gray-50 cursor-not-allowed opacity-70",
              )}
            >
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center shrink-0",
                  available ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-400",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", available ? "text-gray-900" : "text-gray-400 line-through")}>{slot.label}</p>
                <p className={cn("text-[11px] font-medium", available ? "text-emerald-600" : "text-rose-500")}>
                  {isCurrent ? "Current schedule" : slotStatusLabel(slot)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
