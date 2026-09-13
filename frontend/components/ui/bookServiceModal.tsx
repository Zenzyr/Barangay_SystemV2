"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarCheck, X, Briefcase, Wrench } from "lucide-react";

interface SkillItem {
  _id: string;
  skill: string;
  experience: number;
  proficiency: string;
  availability?: string;
  services?: string[];
  serviceTypes?: string[];
}

interface BookServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentName: string;
  residentSkills: SkillItem[];
  onBook: (data: {
    skill: string;
    service: string;
    description: string;
  }) => Promise<void>;
}

const skillServices = (s: SkillItem): string[] =>
  s.serviceTypes?.length ? s.serviceTypes : s.services || [];

const isSkillAvailable = (s: SkillItem): boolean =>
  !s.availability || s.availability === "available";

export default function BookServiceModal({
  open,
  onOpenChange,
  residentName,
  residentSkills,
  onBook,
}: BookServiceModalProps) {
  const [skill, setSkill] = useState("");
  const [service, setService] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedSkill = residentSkills.find((s) => s.skill === skill);

  const resetForm = () => {
    setSkill("");
    setService("");
    setDescription("");
  };

  const handleSkillChange = (value: string) => {
    setSkill(value);
    setService("");
  };

  const handleSubmit = async () => {
    if (!skill || !service || !description.trim()) return;

    setLoading(true);
    try {
      await onBook({
        skill,
        service,
        description: description.trim(),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md bg-white rounded-2xl p-0 gap-0"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CalendarCheck className="size-5 text-sky-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Book a Service
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Book a service from {residentName}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Skill Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-gray-400" />
              Select Skill
            </Label>
            <Select value={skill} onValueChange={handleSkillChange}>
              <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400">
                <SelectValue placeholder="Choose a skill..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {residentSkills.map((s) => (
                  <SelectItem
                    key={s._id}
                    value={s.skill}
                    disabled={!isSkillAvailable(s)}
                    className={
                      !isSkillAvailable(s)
                        ? "text-red-500 data-disabled:opacity-100 data-disabled:text-red-500"
                        : ""
                    }
                  >
                    <span className="flex items-center justify-between w-full gap-3">
                      <span>{s.skill}</span>
                      {!isSkillAvailable(s) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
                          Busy
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {residentSkills.length > 0 &&
              !residentSkills.some((s) => isSkillAvailable(s)) && (
                <p className="text-xs text-red-500">
                  All skills of this resident are currently busy.
                </p>
              )}
          </div>

          {/* Service Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Wrench className="size-3.5 text-gray-400" />
              Select Service
            </Label>
            <Select
              value={service}
              onValueChange={setService}
              disabled={!skill}
            >
              <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400">
                <SelectValue
                  placeholder={
                    skill
                      ? "Choose a service..."
                      : "Select a skill first"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {selectedSkill && skillServices(selectedSkill).length ? (
                  skillServices(selectedSkill).map((svc) => (
                    <SelectItem key={svc} value={svc}>
                      {svc}
                    </SelectItem>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-400">
                    No services available for this skill
                  </p>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label
              htmlFor="booking-description"
              className="text-sm font-medium text-gray-700"
            >
              Description of Work Needed
            </Label>
            <Textarea
              id="booking-description"
              placeholder="Describe the work you need done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 border-gray-200 focus:border-sky-400 resize-y"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
              Status:
            </span>
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-full">
              Pending
            </span>
            <span className="text-[11px] text-amber-600">
              The worker will confirm your booking.
            </span>
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs text-gray-400">
            {!skill && <p>Select a skill to book</p>}
            {skill && !service && (
              <p>Select which service you want to book</p>
            )}
            {!description.trim() && (
              <p>Write a short description of the work needed</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="h-9 border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !skill || !service || !description.trim()}
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Booking...
              </>
            ) : (
              <>
                <CalendarCheck className="size-4" />
                Book Service
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}