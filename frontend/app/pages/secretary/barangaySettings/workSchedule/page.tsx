"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { WEEKDAY_LABELS, formatTime12h } from "@/app/utils/workRequest";
import { workScheduleSettings } from "@/app/types/barangaySettings.type";
import { useWorkScheduleConfig } from "@/components/workRequest/SchedulePicker";
import { cn } from "@/lib/utils";

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function validate(form: workScheduleSettings): string | null {
  if (form.slots.length === 0) return "Add at least one time slot.";
  const sorted = [...form.slots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (!s.startTime || !s.endTime) return "Every slot needs a start and end time.";
    if (toMinutes(s.endTime) <= toMinutes(s.startTime)) return `Slot ${s.startTime}–${s.endTime} must end after it starts.`;
    if (i > 0 && toMinutes(s.startTime) < toMinutes(sorted[i - 1].endTime)) return "Time slots must not overlap.";
  }
  if (!Number.isInteger(form.slotCapacity) || form.slotCapacity < 1 || form.slotCapacity > 50) return "Capacity must be between 1 and 50.";
  if (!Number.isInteger(form.bookingWindowDays) || form.bookingWindowDays < 1 || form.bookingWindowDays > 180) return "Booking window must be between 1 and 180 days.";
  if (form.workingDays.length === 0) return "Select at least one working day.";
  return null;
}

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdminGuard();
  const store = useBarangaySettingsStore();
  const { data: config, isLoading } = useWorkScheduleConfig(isSuperAdmin);
  const [form, setForm] = useState<workScheduleSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const [resolvedConfig, setResolvedConfig] = useState(config);
  if (config !== resolvedConfig) {
    setResolvedConfig(config);
    if (config) setForm({ ...config, slots: config.slots.map((s) => ({ ...s })), workingDays: [...config.workingDays] });
  }

  if (!isSuperAdmin) return null;

  const error = form ? validate(form) : null;

  const save = async () => {
    if (!form || error) return;
    setSaving(true);
    try {
      const updated = await settingsApi.update({ workSchedule: form });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["work-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("Work request schedule saved.");
    } catch (e) {
      errorAlert(apiErrorMessage(e, "Failed to save the work schedule."));
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = (index: number, key: "startTime" | "endTime", value: string) =>
    setForm((f) => (f ? { ...f, slots: f.slots.map((s, i) => (i === index ? { ...s, [key]: value } : s)) } : f));

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <CalendarClock className="mr-2 inline size-6 text-sky-600" />
          Work Request Schedule
        </h1>
        <p className="text-sm text-slate-500">
          Define the time slots residents can book for work requests and how many requests each provider can take per slot.
        </p>
      </div>

      {isLoading || !form ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <CalendarClock className="size-4 text-sky-600" /> Time Slots
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForm({ ...form, slots: [...form.slots, { startTime: "15:00", endTime: "16:00" }] })}
                disabled={form.slots.length >= 24}
              >
                <Plus className="size-4" /> Add Slot
              </Button>
            </div>
            <div className="space-y-2">
              {form.slots.map((slot, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Start</Label>
                    <Input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, "startTime", e.target.value)} className="w-36" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">End</Label>
                    <Input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, "endTime", e.target.value)} className="w-36" />
                  </div>
                  <p className="text-xs text-slate-500 pb-2 flex-1 min-w-32">
                    {slot.startTime && slot.endTime ? `${formatTime12h(slot.startTime)} – ${formatTime12h(slot.endTime)}` : ""}
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => setForm({ ...form, slots: form.slots.filter((_, j) => j !== i) })} aria-label="Remove slot">
                    <Trash2 className="size-4 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Users className="size-4 text-sky-600" /> Capacity & Availability
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Requests per provider per slot</Label>
                <Input type="number" min={1} max={50} value={form.slotCapacity} onChange={(e) => setForm({ ...form, slotCapacity: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">A slot shows as fully booked once this many pending or active requests hold it.</p>
              </div>
              <div className="grid gap-2">
                <Label>Booking window (days ahead)</Label>
                <Input type="number" min={1} max={180} value={form.bookingWindowDays} onChange={(e) => setForm({ ...form, bookingWindowDays: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = form.workingDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          workingDays: active ? form.workingDays.filter((d) => d !== day) : [...form.workingDays, day].sort(),
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        active ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving || !!error}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Schedule
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
