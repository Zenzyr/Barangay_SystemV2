"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { WorkRequestItem } from "@/app/types/work.type";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { formatScheduleDate, formatTime12h } from "@/app/utils/workRequest";
import { successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePickerGrid, TimeSlotGrid, useWorkScheduleConfig } from "./SchedulePicker";
import { ScheduleBlock } from "./WorkRequestCard";
import { CalendarClock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RescheduleDialog({
  item,
  onOpenChange,
}: {
  item: WorkRequestItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const open = !!item;
  const { data: config } = useWorkScheduleConfig(open);
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [wholeDay, setWholeDay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolvedItem, setResolvedItem] = useState(item);
  if (item !== resolvedItem) {
    setResolvedItem(item);
    setDate(item?.scheduledDate ?? null);
    setStartTime(null);
    setWholeDay(item?.wholeDay ?? false);
    setError(null);
  }

  const isService = item?.kind === "service";
  const selectedSlot = config?.slots.find((s) => s.startTime === startTime);
  const proposedLabel = wholeDay
    ? "Whole day"
    : selectedSlot
      ? `${formatTime12h(selectedSlot.startTime)} – ${formatTime12h(selectedSlot.endTime)}`
      : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.patch(`/work/requests/${item?.kind}/${item?._id}/schedule`, {
        scheduledDate: date,
        startTime,
        wholeDay,
      });
      return res.data as WorkRequestItem;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["work-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-schedule"] });
      successAlert(`Rescheduled to ${formatScheduleDate(updated.scheduledDate)}, ${updated.scheduleLabel}`);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(apiErrorMessage(err, "Failed to reschedule the work request"));
      setStartTime(null);
      queryClient.invalidateQueries({ queryKey: ["work-schedule", "availability"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl bg-white rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <CalendarClock className="size-4 text-sky-600" />
            Reschedule Work Request
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {item?.title} · {item?.provider?.name}. The provider will be notified of the new schedule.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Current schedule</p>
              <ScheduleBlock item={item} compact />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">New date</p>
              <DatePickerGrid
                config={config}
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setStartTime(null);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">New time slot</p>
              {isService && (
                <button
                  type="button"
                  onClick={() => {
                    setWholeDay((v) => !v);
                    setStartTime(null);
                    setError(null);
                  }}
                  aria-pressed={wholeDay}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all flex items-start gap-3",
                    wholeDay ? "border-sky-400 bg-sky-50/60 ring-2 ring-sky-200" : "border-gray-200 hover:border-sky-300",
                  )}
                >
                  <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", wholeDay ? "bg-sky-100 text-sky-600" : "bg-gray-100 text-gray-400")}>
                    <CalendarClock className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Take the whole day</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reserve every time slot for the new date.</p>
                  </div>
                </button>
              )}
              {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
              {wholeDay ? (
                <p className="text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                  The provider&apos;s entire day will be reserved.
                </p>
              ) : (
                <TimeSlotGrid
                  providerId={item.provider?._id}
                  date={date}
                  value={startTime}
                  currentSlot={{ date: item.scheduledDate, startTime: item.scheduleStartTime }}
                  onChange={(t) => {
                    setStartTime(t);
                    setError(null);
                  }}
                />
              )}
            </div>
            {date && proposedLabel && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">New schedule</p>
                <ScheduleBlock item={{ scheduledDate: date, scheduleLabel: proposedLabel }} compact />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-gray-200" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-sky-500 to-emerald-500 text-white"
                disabled={!date || (!wholeDay && !startTime) || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
