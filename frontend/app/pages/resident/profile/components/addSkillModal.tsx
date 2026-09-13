"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, Briefcase } from "lucide-react";

const PRESET_SKILLS = [
  "Teaching",
  "Barbering",
  "Cooking",
  "Farming",
  "Caretaker",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Tailoring",
  "Driving",
  "Welding",
  "Masonry",
  "Painting",
  "Baking",
  "Sewing",
  "Computer Repair",
  "Tutoring",
  "Photography",
  "Event Planning",
  "Nursing Assistance",
];

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"];

interface AddSkillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (skill: {
    skill: string;
    experience: number;
    proficiency: string;
    serviceTypes: string[];
  }) => Promise<void>;
}

export default function AddSkillModal({
  open,
  onOpenChange,
  onAdd,
}: AddSkillModalProps) {
  const [skill, setSkill] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [experience, setExperience] = useState("");
  const [proficiency, setProficiency] = useState("");
  const [serviceTypesInput, setServiceTypesInput] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setSkill("");
    setCustomSkill("");
    setUseCustom(false);
    setExperience("");
    setProficiency("");
    setServiceTypesInput("");
  };

  const handleSubmit = async () => {
    const skillName = useCustom ? customSkill.trim() : skill;

    if (!skillName) {
      return;
    }

    const exp = Number(experience);
    if (!experience || isNaN(exp) || exp < 0) {
      return;
    }

    if (!proficiency) {
      return;
    }

    const serviceTypes = serviceTypesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      await onAdd({
        skill: skillName,
        experience: exp,
        proficiency,
        serviceTypes,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error is handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 gap-0">
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                <Briefcase className="size-5 text-sky-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Add Skill
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Tell the community about your skills
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Skill Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Skill
            </Label>
            {!useCustom ? (
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400">
                  <SelectValue placeholder="Select a skill..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {PRESET_SKILLS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Enter your skill..."
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                className="h-10 border-gray-200 focus:border-sky-400"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setUseCustom(!useCustom);
                setSkill("");
                setCustomSkill("");
              }}
              className="text-xs text-sky-600 hover:text-sky-700 transition-colors mt-1"
            >
              {useCustom
                ? "Pick from list instead"
                : "My skill is not in the list"}
            </button>
          </div>

          {/* Years of Experience */}
          <div className="space-y-1.5">
            <Label
              htmlFor="experience"
              className="text-sm font-medium text-gray-700"
            >
              Years of Experience
            </Label>
            <Input
              id="experience"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 3"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="h-10 border-gray-200 focus:border-sky-400"
            />
          </div>

          {/* Proficiency */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Proficiency Level
            </Label>
            <Select value={proficiency} onValueChange={setProficiency}>
              <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400">
                <SelectValue placeholder="Select proficiency..." />
              </SelectTrigger>
              <SelectContent>
                {PROFICIENCY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Types */}
          <div className="space-y-1.5">
            <Label htmlFor="serviceTypes" className="text-sm font-medium text-gray-700">
              Service Types <span className="text-gray-400 font-normal">(optional, comma-separated)</span>
            </Label>
            <Input
              id="serviceTypes"
              placeholder="e.g. Cabinet Repair, Furniture Making, Door Repair"
              value={serviceTypesInput}
              onChange={(e) => setServiceTypesInput(e.target.value)}
              className="h-10 border-gray-200 focus:border-sky-400"
            />
            <p className="text-[11px] text-gray-400">
              Specific services you offer under this skill, so clients can find you more precisely.
            </p>
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs text-gray-400">
            {(useCustom ? !customSkill.trim() : !skill) && (
              <p>Select or enter a skill</p>
            )}
            {(!experience || isNaN(Number(experience)) || Number(experience) < 0) && (
              <p>Enter valid years of experience</p>
            )}
            {!proficiency && <p>Select your proficiency level</p>}
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
            disabled={
              loading ||
              (useCustom ? !customSkill.trim() : !skill) ||
              !experience ||
              isNaN(Number(experience)) ||
              Number(experience) < 0 ||
              !proficiency
            }
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add Skill
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
