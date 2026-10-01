"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { DayAvailability, WorkRequestKind } from "@/app/types/work.type";
import { apiErrorMessage, formatCurrency } from "@/app/utils/transactionFormat";
import { WORK_KIND_LABELS, formatScheduleDate, formatTime12h } from "@/app/utils/workRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePickerGrid, TimeSlotGrid, useWorkScheduleConfig } from "./SchedulePicker";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileSignature,
  Hammer,
  Loader2,
  MapPin,
  Send,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_DESCRIPTION = 2000;

interface ProviderSkill {
  skill: string;
  serviceTypes?: string[];
  services?: string[];
  availability?: string;
}

export interface WorkRequestProvider {
  _id: string;
  name: string;
  skills: ProviderSkill[];
}

type Step = "type" | "details" | "date" | "time" | "review" | "done";

const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "type", label: "Category" },
  { key: "details", label: "Details" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "review", label: "Review" },
];

const skillServices = (s: ProviderSkill) => (s.serviceTypes?.length ? s.serviceTypes : s.services || []);
const isSkillAvailable = (s: ProviderSkill) => !s.availability || s.availability === "available";

interface Confirmation {
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

export function CreateWorkRequestModal({
  open,
  onOpenChange,
  provider,
  defaultLocation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: WorkRequestProvider;
  defaultLocation?: string;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<WorkRequestKind>("booking");
  const [skill, setSkill] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [customServiceType, setCustomServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [slotLabel, setSlotLabel] = useState("");
  const [slotError, setSlotError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: config } = useWorkScheduleConfig(open);

  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setStep("type");
    setKind("booking");
    setSkill(provider.skills.find(isSkillAvailable)?.skill || "");
    setServiceType("");
    setCustomServiceType("");
    setDescription("");
    setLocation(defaultLocation || "");
    setBudget("");
    setNotes("");
    setDate(null);
    setStartTime(null);
    setSlotLabel("");
    setSlotError(null);
    setConfirmation(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const selectedSkill = provider.skills.find((s) => s.skill === skill);
  const services = selectedSkill ? skillServices(selectedSkill) : [];
  const finalService = serviceType === "__custom__" ? customServiceType.trim() : serviceType;
  const budgetNum = budget === "" ? 0 : Number(budget);
  const budgetValid = budget === "" || (Number.isFinite(budgetNum) && budgetNum >= 0);

  const canContinue: Record<Exclude<Step, "done">, boolean> = {
    type: !!skill && !!finalService && !!selectedSkill && isSkillAvailable(selectedSkill),
    details:
      description.trim().length > 0 &&
      description.trim().length <= MAX_DESCRIPTION &&
      (kind === "booking" || (location.trim().length > 0 && budgetValid)),
    date: !!date,
    time: !!startTime,
    review: !!date && !!startTime,
  };

  const goTo = (next: Step) => {
    setSlotError(null);
    setStep(next);
  };

  const invalidateAvailability = () =>
    queryClient.invalidateQueries({ queryKey: ["work-schedule", "availability", provider._id] });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (kind === "booking") {
        const res = await axiosInstance.post("/account/book", {
          worker: provider._id,
          skill,
          service: finalService,
          description: description.trim(),
          scheduledDate: date,
          startTime,
        });
        return res.data;
      }
      const res = await axiosInstance.post("/service-requests", {
        provider: provider._id,
        skill,
        serviceType: finalService,
        description: description.trim(),
        location: location.trim(),
        budget: budgetNum,
        notes: notes.trim(),
        scheduledDate: date,
        startTime,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["work-requests"] });
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      invalidateAvailability();
      setConfirmation({
        scheduledDate: data?.scheduledDate || date || "",
        startTime: data?.scheduleStartTime || startTime || "",
        endTime: data?.scheduleEndTime || "",
      });
      setStep("done");
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = apiErrorMessage(err, "Failed to submit the work request");
      if (status === 409) {
        invalidateAvailability();
        setStartTime(null);
        setSlotError(message);
        setStep("time");
        return;
      }
      toast.error(message);
    },
  });

  const finalCheckAndSubmit = async () => {
    if (!date || !startTime) return;
    setChecking(true);
    try {
      const latest = await queryClient.fetchQuery<DayAvailability>({
        queryKey: ["work-schedule", "availability", provider._id, date],
        queryFn: async () => (await axiosInstance.get("/work/schedule/availability", { params: { provider: provider._id, date } })).data,
        staleTime: 0,
      });
      const slot = latest.slots.find((s) => s.startTime === startTime);
      if (!latest.open || !slot || slot.status !== "available") {
        setStartTime(null);
        setSlotError("That time slot was just taken. Please choose another available slot.");
        setStep("time");
        return;
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not verify slot availability. Please try again."));
      return;
    } finally {
      setChecking(false);
    }
    submitMutation.mutate();
  };

  const activeIndex = STEPS.findIndex((s) => s.key === step);
  const previous: Partial<Record<Step, Step>> = { details: "type", date: "details", time: "date", review: "time" };
  const nextStep: Partial<Record<Step, Step>> = { type: "details", details: "date", date: "time", time: "review" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl bg-white rounded-2xl p-0 gap-0 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 pb-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-emerald-50/50">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-sm shrink-0">
                  <Hammer className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-gray-900">New Work Request</DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 truncate">with {provider.name}</DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>
          {step !== "done" && (
            <div className="flex items-center gap-1.5 mt-4 overflow-x-auto">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1.5 flex-1 last:flex-none min-w-fit">
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap",
                      step === s.key
                        ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-white"
                        : activeIndex > i
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400",
                    )}
                  >
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 min-w-2 bg-gray-200" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {step === "type" && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Request type</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      { value: "booking", icon: Zap, title: "Quick Booking", text: "Book a scheduled job. The provider approves and completes it." },
                      { value: "service", icon: FileSignature, title: "Service Contract", text: "Include a location and budget. A contract is created on acceptance." },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        kind === opt.value ? "border-sky-400 bg-sky-50/60 ring-2 ring-sky-200" : "border-gray-200 hover:border-sky-300",
                      )}
                    >
                      <opt.icon className={cn("size-4 mb-1.5", kind === opt.value ? "text-sky-600" : "text-gray-400")} />
                      <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.text}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Category (skill)</label>
                  <Select
                    value={skill}
                    onValueChange={(v) => {
                      setSkill(v);
                      setServiceType("");
                      setCustomServiceType("");
                    }}
                  >
                    <SelectTrigger className="w-full h-10 border-gray-200 bg-white">
                      <SelectValue placeholder="Select a skill" />
                    </SelectTrigger>
                    <SelectContent>
                      {provider.skills.map((s) => (
                        <SelectItem key={s.skill} value={s.skill} disabled={!isSkillAvailable(s)}>
                          {s.skill}
                          {!isSkillAvailable(s) && " (busy)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Service</label>
                  <Select value={serviceType} onValueChange={setServiceType} disabled={!skill}>
                    <SelectTrigger className="w-full h-10 border-gray-200 bg-white">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other (specify)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {serviceType === "__custom__" && (
                <Input
                  placeholder="Describe the service type"
                  value={customServiceType}
                  maxLength={100}
                  onChange={(e) => setCustomServiceType(e.target.value)}
                  className="h-10 border-gray-200"
                />
              )}
            </>
          )}

          {step === "details" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">What do you need done?</label>
                <Textarea
                  value={description}
                  maxLength={MAX_DESCRIPTION}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work, the problem, and anything the provider should know..."
                  className="min-h-28 border-gray-200"
                />
                <p className="text-[11px] text-gray-400 text-right">
                  {description.trim().length}/{MAX_DESCRIPTION}
                </p>
              </div>
              {kind === "service" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where will the work be done?" className="h-10 border-gray-200" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Budget (optional)</label>
                      <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" className="h-10 border-gray-200" />
                      {!budgetValid && <p className="text-xs text-rose-600">Budget must be zero or more.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
                      <Input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Extra notes" className="h-10 border-gray-200" />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === "date" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Choose a date</p>
              <DatePickerGrid
                config={config}
                value={date}
                onChange={(d) => {
                  if (d !== date) {
                    setStartTime(null);
                    setSlotLabel("");
                  }
                  setDate(d);
                }}
              />
            </div>
          )}

          {step === "time" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700">Choose a time slot</p>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatScheduleDate(date)}
                </span>
              </div>
              {slotError && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{slotError}</p>}
              <TimeSlotGrid
                providerId={provider._id}
                date={date}
                value={startTime}
                onChange={(t, slot) => {
                  setStartTime(t);
                  setSlotLabel(slot.label);
                  setSlotError(null);
                }}
              />
            </div>
          )}

          {step === "review" && (
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-3 text-white">
                <p className="text-[11px] uppercase tracking-wider opacity-80">{WORK_KIND_LABELS[kind]}</p>
                <p className="text-base font-semibold">{finalService}</p>
                <p className="text-xs opacity-90">
                  {skill} · with {provider.name}
                </p>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <CalendarCheck className="size-4 text-sky-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">{formatScheduleDate(date)}</p>
                    <p className="text-gray-600">{slotLabel || (startTime ? formatTime12h(startTime) : "")}</p>
                  </div>
                </div>
                <p className="text-gray-600 whitespace-pre-line">{description.trim()}</p>
                {kind === "service" && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {location.trim()}
                    </span>
                    {budgetNum > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="size-3.5" />
                        {formatCurrency(budgetNum)}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-gray-400">Availability is re-checked when you submit.</p>
              </div>
            </div>
          )}

          {step === "done" && confirmation && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="size-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Work request submitted</p>
                <p className="text-sm text-gray-500">{provider.name} will be notified to confirm your request.</p>
              </div>
              <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 flex items-center gap-3 text-left">
                <Clock className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatScheduleDate(confirmation.scheduledDate)}</p>
                  <p className="text-sm text-gray-600">
                    {formatTime12h(confirmation.startTime)}
                    {confirmation.endTime && ` – ${formatTime12h(confirmation.endTime)}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
          {step === "done" ? (
            <Button onClick={() => onOpenChange(false)} className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 text-white">
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => (previous[step] ? goTo(previous[step] as Step) : onOpenChange(false))}
                className="h-10 border-gray-200 text-gray-600"
                disabled={submitMutation.isPending || checking}
              >
                <ArrowLeft className="size-4" />
                {previous[step] ? "Back" : "Cancel"}
              </Button>
              {step === "review" ? (
                <Button
                  onClick={finalCheckAndSubmit}
                  disabled={!canContinue.review || submitMutation.isPending || checking}
                  className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-50"
                >
                  {submitMutation.isPending || checking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {checking ? "Checking availability..." : submitMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              ) : (
                <Button
                  onClick={() => nextStep[step] && goTo(nextStep[step] as Step)}
                  disabled={!canContinue[step]}
                  className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-40"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
