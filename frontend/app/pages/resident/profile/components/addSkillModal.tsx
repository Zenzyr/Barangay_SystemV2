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

const OTHER_SKILL_VALUE = "__other__";
const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const MAX_YEARS_EXPERIENCE = 20;

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
  const [experience, setExperience] = useState("");
  const [proficiency, setProficiency] = useState("");
  const [serviceTypesInput, setServiceTypesInput] = useState("");
  const [loading, setLoading] = useState(false);

  const useCustom = skill === OTHER_SKILL_VALUE;

  const resetForm = () => {
    setSkill("");
    setCustomSkill("");
    setExperience("");
    setProficiency("");
    setServiceTypesInput("");
  };

  const skillName = useCustom ? customSkill.trim() : skill;
  const expNumber = Number(experience);
  const experienceValid =
    experience !== "" &&
    Number.isFinite(expNumber) &&
    Number.isInteger(expNumber) &&
    expNumber >= 0 &&
    expNumber <= MAX_YEARS_EXPERIENCE;
  const serviceTypes = serviceTypesInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const serviceTypesValid = serviceTypes.length > 0;

  const handleSubmit = async () => {
    if (!skillName || !experienceValid || !proficiency || !serviceTypesValid) {
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        skill: skillName,
        experience: expNumber,
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
              Skill <span className="text-red-500">*</span>
            </Label>
            <Select
              value={skill}
              onValueChange={(value) => {
                setSkill(value);
                if (value !== OTHER_SKILL_VALUE) setCustomSkill("");
              }}
            >
              <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400">
                <SelectValue placeholder="Select a skill..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {PRESET_SKILLS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_SKILL_VALUE}>Other</SelectItem>
              </SelectContent>
            </Select>
            {useCustom && (
              <Input
                placeholder="Enter your skill..."
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                className="h-10 border-gray-200 focus:border-sky-400 mt-2"
              />
            )}
          </div>

          {/* Years of Experience */}
          <div className="space-y-1.5">
            <Label
              htmlFor="experience"
              className="text-sm font-medium text-gray-700"
            >
              Years of Experience <span className="text-red-500">*</span>
            </Label>
            <Input
              id="experience"
              type="number"
              min="0"
              max={MAX_YEARS_EXPERIENCE}
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
              Proficiency Level <span className="text-red-500">*</span>
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
            <Label
              htmlFor="serviceTypes"
              className="text-sm font-medium text-gray-700"
            >
              Service Types <span className="text-red-500">*</span>
            </Label>
            <Input
              id="serviceTypes"
              placeholder="e.g. Cabinet Repair, Furniture Making, Door Repair"
              value={serviceTypesInput}
              onChange={(e) => setServiceTypesInput(e.target.value)}
              className="h-10 border-gray-200 focus:border-sky-400"
            />
            <p className="text-[11px] text-gray-400">
              Comma-separated. Specific services you offer under this skill, so
              clients can find you more precisely.
            </p>
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs text-gray-400">
            {!skillName && <p>Select or enter a skill</p>}
            {!experienceValid && (
              <p>Enter years of experience between 0 and {MAX_YEARS_EXPERIENCE}</p>
            )}
            {!proficiency && <p>Select your proficiency level</p>}
            {!serviceTypesValid && <p>Enter at least one service type</p>}
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
            disabled={loading || !skillName || !experienceValid || !proficiency || !serviceTypesValid}
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
