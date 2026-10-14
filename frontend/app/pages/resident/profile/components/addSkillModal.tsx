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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Briefcase } from "lucide-react";
import {
  PRESET_SKILLS,
  OTHER_SKILL_VALUE,
  serviceTypesForSkill,
} from "@/lib/constants/serviceTypes";

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const MAX_YEARS_EXPERIENCE = 20;
const MIN_SKILL_NAME_LENGTH = 2;
const MAX_SKILL_NAME_LENGTH = 80;
const MIN_SERVICE_TYPE_LENGTH = 2;
const MAX_SERVICE_TYPE_LENGTH = 60;
const MAX_SERVICE_TYPES = 10;
const SKILL_NAME_REGEX = /^[a-zA-ZñÑ\s.'&-]+$/;
const SERVICE_TYPE_REGEX = /^[a-zA-ZñÑ0-9\s.'&/()-]+$/;

interface AddSkillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (skill: {
    skill: string;
    experience: number;
    proficiency: string;
    serviceTypes: string[];
    customServiceTypes?: string[];
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
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [useCustomServiceTypes, setUseCustomServiceTypes] = useState(false);
  const [customServiceTypesInput, setCustomServiceTypesInput] = useState("");
  const [loading, setLoading] = useState(false);

  const useCustom = skill === OTHER_SKILL_VALUE;
  const availableServiceTypes = skill ? serviceTypesForSkill(skill) : [];

  const resetForm = () => {
    setSkill("");
    setCustomSkill("");
    setExperience("");
    setProficiency("");
    setSelectedServiceTypes([]);
    setUseCustomServiceTypes(false);
    setCustomServiceTypesInput("");
  };

  const customServiceTypes = useCustomServiceTypes
    ? customServiceTypesInput
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .filter(
          (s, i, arr) =>
            arr.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i
        )
    : [];

  const toggleServiceType = (serviceType: string) => {
    setSelectedServiceTypes((prev) =>
      prev.includes(serviceType)
        ? prev.filter((s) => s !== serviceType)
        : prev.length + customServiceTypes.length >= MAX_SERVICE_TYPES
          ? prev
          : [...prev, serviceType]
    );
  };

  const skillName = useCustom ? customSkill.trim() : skill;
  const skillNameValid =
    skillName.length >= MIN_SKILL_NAME_LENGTH &&
    skillName.length <= MAX_SKILL_NAME_LENGTH &&
    SKILL_NAME_REGEX.test(skillName);
  const skillNameError = !skillName
    ? "Please enter a valid skill"
    : !skillNameValid
      ? `Please enter a valid skill (${MIN_SKILL_NAME_LENGTH}-${MAX_SKILL_NAME_LENGTH} letters, spaces, - . ' & only)`
      : "";
  const expNumber = Number(experience);
  const experienceValid =
    experience !== "" &&
    Number.isFinite(expNumber) &&
    Number.isInteger(expNumber) &&
    expNumber >= 0 &&
    expNumber <= MAX_YEARS_EXPERIENCE;
  const serviceTypes = selectedServiceTypes;
  const totalServiceTypes =
    selectedServiceTypes.length + customServiceTypes.length;
  const customServiceTypesValid = customServiceTypes.every(
    (s) =>
      s.length >= MIN_SERVICE_TYPE_LENGTH &&
      s.length <= MAX_SERVICE_TYPE_LENGTH &&
      SERVICE_TYPE_REGEX.test(s)
  );
  const serviceTypesValid =
    totalServiceTypes > 0 &&
    totalServiceTypes <= MAX_SERVICE_TYPES &&
    customServiceTypesValid;
  const serviceTypesError =
    totalServiceTypes === 0 ||
    (useCustomServiceTypes && customServiceTypes.length === 0)
      ? "Please enter a valid service type"
      : totalServiceTypes > MAX_SERVICE_TYPES
        ? `Please select at most ${MAX_SERVICE_TYPES} service types`
        : !customServiceTypesValid
          ? `Please enter a valid service type (${MIN_SERVICE_TYPE_LENGTH}-${MAX_SERVICE_TYPE_LENGTH} letters, numbers, spaces, - . ' & / ( ) only)`
          : "";

  const handleSubmit = async () => {
    if (!skillNameValid || !experienceValid || !proficiency || !serviceTypesValid) {
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        skill: skillName,
        experience: expNumber,
        proficiency,
        serviceTypes,
        customServiceTypes,
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
                setSelectedServiceTypes([]);
                setUseCustomServiceTypes(false);
                setCustomServiceTypesInput("");
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
                maxLength={MAX_SKILL_NAME_LENGTH}
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
            <Label className="text-sm font-medium text-gray-700">
              Service Types <span className="text-red-500">*</span>
            </Label>
            {!skill ? (
              <p className="text-xs text-gray-400 py-2">
                Select a skill first to see available service types.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  <div className="max-h-44 overflow-y-auto">
                    {availableServiceTypes.map((serviceType) => (
                      <label
                        key={serviceType}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedServiceTypes.includes(serviceType)}
                          onCheckedChange={() => toggleServiceType(serviceType)}
                        />
                        {serviceType}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      checked={useCustomServiceTypes}
                      onCheckedChange={(checked) =>
                        setUseCustomServiceTypes(Boolean(checked))
                      }
                    />
                    Other (specify)
                  </label>
                </div>
                {useCustomServiceTypes && (
                  <Input
                    placeholder="Enter your service type..."
                    value={customServiceTypesInput}
                    onChange={(e) => setCustomServiceTypesInput(e.target.value)}
                    className="h-10 border-gray-200 focus:border-sky-400"
                  />
                )}
                <p className="text-[11px] text-gray-400">
                  {useCustom
                    ? "Pick the closest services for your custom skill. "
                    : ""}
                  {totalServiceTypes}/{MAX_SERVICE_TYPES} selected. Separate
                  multiple custom services with commas.
                </p>
              </>
            )}
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs text-gray-400">
            {skillNameError && <p>{skillNameError}</p>}
            {!experienceValid && (
              <p>Enter years of experience between 0 and {MAX_YEARS_EXPERIENCE}</p>
            )}
            {!proficiency && <p>Select your proficiency level</p>}
            {serviceTypesError && <p>{serviceTypesError}</p>}
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
            disabled={loading || !skillNameValid || !experienceValid || !proficiency || !serviceTypesValid}
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
