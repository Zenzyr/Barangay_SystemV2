"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Send, X, Wrench } from "lucide-react";

interface SkillOption {
  skill: string;
  serviceTypes?: string[];
}

interface RequestServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  providerSkills: SkillOption[];
  defaultLocation?: string;
  onSubmit: (data: {
    skill: string;
    serviceType: string;
    description: string;
    preferredDate: string;
    preferredTime: string;
    location: string;
    budget: number;
    notes: string;
  }) => Promise<void>;
}

export default function RequestServiceModal({
  open,
  onOpenChange,
  providerName,
  providerSkills,
  defaultLocation,
  onSubmit,
}: RequestServiceModalProps) {
  const [skill, setSkill] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [customServiceType, setCustomServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setSkill(providerSkills[0]?.skill || "");
    setLocation(defaultLocation || "");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const [resolvedSkill, setResolvedSkill] = useState(skill);
  if (skill !== resolvedSkill) {
    setResolvedSkill(skill);
    setServiceType("");
    setCustomServiceType("");
  }

  const resetForm = () => {
    setSkill("");
    setServiceType("");
    setCustomServiceType("");
    setDescription("");
    setPreferredDate("");
    setPreferredTime("");
    setLocation("");
    setBudget("");
    setNotes("");
  };

  const selectedSkillOption = providerSkills.find((s) => s.skill === skill);
  const availableServiceTypes = selectedSkillOption?.serviceTypes || [];
  const finalServiceType = serviceType === "__custom__" ? customServiceType.trim() : serviceType;

  const isValid = skill && finalServiceType && description.trim() && location.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await onSubmit({
        skill,
        serviceType: finalServiceType,
        description: description.trim(),
        preferredDate,
        preferredTime,
        location: location.trim(),
        budget: budget ? Number(budget) : 0,
        notes: notes.trim(),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <Wrench className="size-5 text-sky-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">Request a Service</DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Send a request to {providerName}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => { resetForm(); onOpenChange(false); }}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Skill</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger className="w-full h-10 border-gray-200"><SelectValue placeholder="Select skill" /></SelectTrigger>
                <SelectContent>
                  {providerSkills.map((s) => (
                    <SelectItem key={s.skill} value={s.skill}>{s.skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="w-full h-10 border-gray-200"><SelectValue placeholder="Select service type" /></SelectTrigger>
                <SelectContent>
                  {availableServiceTypes.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other / describe below</SelectItem>
                </SelectContent>
              </Select>
              {serviceType === "__custom__" && (
                <Input
                  placeholder="Describe the service type"
                  value={customServiceType}
                  onChange={(e) => setCustomServiceType(e.target.value)}
                  className="h-10 border-gray-200 mt-1.5"
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Service Description</Label>
            <Textarea
              placeholder="Describe what you need done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 border-gray-200 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Preferred Date</Label>
              <input
                type="date"
                value={preferredDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Preferred Time</Label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Service Location</Label>
            <Input
              placeholder="Where should the service happen?"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-10 border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Estimated Budget (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-10 pl-7 border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Additional Notes (optional)</Label>
            <Textarea
              placeholder="Anything else the provider should know?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16 border-gray-200 resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl sticky bottom-0">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} className="h-9 border-gray-200 text-gray-600">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4" />Send Request</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
