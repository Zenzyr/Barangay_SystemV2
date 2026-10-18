"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { purokApi } from "@/app/utils/barangayApi";
import {
  Loader2,
  UserRound,
  MapPin,
  Phone,
  Save,
  CalendarDays,
  Users,
  Heart,
  Hash,
  Vote,
} from "lucide-react";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentNickname: string;
  currentContact: string;
  currentGender: string;
  currentDateOfBirth: string;
  currentCivilStatus: string;
  currentPurok: string;
  currentVoterStatus: string;
  currentHouseHoldNumber: string;
  currentMonthlySalary: number;
  onSave: (data: {
    nickname: string;
    contact: string;
    gender: string;
    dateOfBirth: string;
    civilStatus: string;
    purok: string;
    voterStatus: string;
    houseHoldNumber: string;
    monthlySalary: number;
  }) => Promise<void>;
}

const HOUSEHOLD_NUMBER_PATTERN = /^HH-(?!0+$)\d{3,4}$/i;

export default function EditProfileModal({
  open,
  onOpenChange,
  currentName,
  currentNickname,
  currentContact,
  currentGender,
  currentDateOfBirth,
  currentCivilStatus,
  currentPurok,
  currentVoterStatus,
  currentHouseHoldNumber,
  currentMonthlySalary,
  onSave,
}: EditProfileModalProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [contact, setContact] = useState(currentContact);
  const [gender, setGender] = useState(currentGender);
  const [dateOfBirth, setDateOfBirth] = useState(currentDateOfBirth);
  const [civilStatus, setCivilStatus] = useState(currentCivilStatus);
  const [purok, setPurok] = useState(currentPurok);
  const [voterStatus, setVoterStatus] = useState(currentVoterStatus);
  const [houseHoldNumber, setHouseHoldNumber] = useState(currentHouseHoldNumber);
  const [monthlySalary, setMonthlySalary] = useState(String(currentMonthlySalary ?? 0));
  const [loading, setLoading] = useState(false);

  const snapshotKey = [
    open,
    currentName,
    currentNickname,
    currentContact,
    currentGender,
    currentDateOfBirth,
    currentCivilStatus,
    currentPurok,
    currentVoterStatus,
    currentHouseHoldNumber,
    currentMonthlySalary,
  ].join("|");
  const [resolvedKey, setResolvedKey] = useState(snapshotKey);
  if (snapshotKey !== resolvedKey) {
    setResolvedKey(snapshotKey);
    setNickname(currentNickname);
    setContact(currentContact);
    setGender(currentGender);
    setDateOfBirth(currentDateOfBirth);
    setCivilStatus(currentCivilStatus);
    setPurok(currentPurok);
    setVoterStatus(currentVoterStatus);
    setHouseHoldNumber(currentHouseHoldNumber);
    setMonthlySalary(String(currentMonthlySalary ?? 0));
  }

  const {
    data: activePuroks = [],
    isLoading: puroksLoading,
    isError: puroksError,
  } = useQuery({
    queryKey: ["puroks", "active"],
    queryFn: purokApi.getActive,
    enabled: open,
  });

  const normalizePurok = (value: string) => value.trim().toLowerCase();
  const findActivePurok = (value: string) =>
    activePuroks.find((p) => normalizePurok(p.name) === normalizePurok(value));
  const selectedPurok = findActivePurok(purok)?.name ?? purok;
  const savedPurokUnavailable =
    !!currentPurok.trim() && !puroksLoading && !findActivePurok(currentPurok);
  const purokChanged = normalizePurok(purok) !== normalizePurok(currentPurok);
  const purokError =
    purokChanged && !puroksLoading && !findActivePurok(purok)
      ? "Please select a valid purok."
      : "";

  const householdNumberChanged = houseHoldNumber.trim() !== currentHouseHoldNumber.trim();
  const householdNumberError =
    householdNumberChanged &&
    houseHoldNumber.trim().toUpperCase() !== "N/A" &&
    !HOUSEHOLD_NUMBER_PATTERN.test(houseHoldNumber.trim())
      ? "Format must be HH-001 to HH-999 or HH-0001 to HH-9999 (e.g. HH-020 or HH-0011)"
      : "";

  const handleSubmit = async () => {
    if (householdNumberError || purokError) return;

    setLoading(true);
    try {
      await onSave({
        nickname: nickname.trim(),
        contact: contact.trim(),
        gender,
        dateOfBirth,
        civilStatus,
        purok:         selectedPurok,
        voterStatus,
        houseHoldNumber,
        monthlySalary: Number(monthlySalary) || 0,
      });
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    nickname !== currentNickname ||
    contact !== currentContact ||
    gender !== currentGender ||
    dateOfBirth !== currentDateOfBirth ||
    civilStatus !== currentCivilStatus ||
    purokChanged ||
    voterStatus !== currentVoterStatus ||
    houseHoldNumber !== currentHouseHoldNumber ||
    (Number(monthlySalary) || 0) !== (currentMonthlySalary ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                <UserRound className="size-5 text-sky-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit Profile
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Update your personal information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-sky-400" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium text-gray-700">
                  Official Name
                </Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <div className="pl-10 h-10 flex items-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                    {currentName}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Your official name can only be changed by barangay staff.
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-nickname" className="text-sm font-medium text-gray-700">
                  Nickname
                </Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="What should we call you?"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-contact" className="text-sm font-medium text-gray-700">
                  Contact Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="0917 123 4567"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-gender" className="text-sm font-medium text-gray-700">
                  Gender
                </Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    id="edit-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Purok / Location */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-emerald-400" />
              Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-purok" className="text-sm font-medium text-gray-700">
                  Purok
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    id="edit-purok"
                    value={selectedPurok}
                    onChange={(e) => setPurok(e.target.value)}
                    disabled={puroksLoading}
                    aria-invalid={!!purokError}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {puroksLoading ? "Loading puroks..." : "Select purok"}
                    </option>
                    {savedPurokUnavailable && (
                      <option value={currentPurok}>
                        {currentPurok} (no longer available)
                      </option>
                    )}
                    {activePuroks.map((p) => (
                      <option key={p._id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {puroksError ? (
                  <p className="text-xs text-red-500">
                    Unable to load puroks. Please try again later.
                  </p>
                ) : !puroksLoading && activePuroks.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No puroks are available at the moment.
                  </p>
                ) : null}
                {purokError && (
                  <p className="text-xs text-red-500">{purokError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-houseHoldNumber" className="text-sm font-medium text-gray-700">
                  Household ID
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-houseHoldNumber"
                    value={houseHoldNumber}
                    onChange={(e) => setHouseHoldNumber(e.target.value)}
                    className={`pl-10 h-10 ${
                      householdNumberError
                        ? "border-red-400 focus:border-red-400"
                        : "border-gray-200 focus:border-sky-400"
                    }`}
                    placeholder="e.g. HH-020 or HH-0011"
                  />
                </div>
                {householdNumberError && (
                  <p className="text-xs text-red-500">{householdNumberError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-monthlySalary" className="text-sm font-medium text-gray-700">
                  Monthly Salary (₱)
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-monthlySalary"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="Enter 0 if none"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Used with your household total for 4Ps / TUPAD eligibility.
                </p>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-amber-400" />
              Personal Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dateOfBirth" className="text-sm font-medium text-gray-700">
                  Date of Birth
                </Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <input
                    id="edit-dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-civilStatus" className="text-sm font-medium text-gray-700">
                  Civil Status
                </Label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    id="edit-civilStatus"
                    value={civilStatus}
                    onChange={(e) => setCivilStatus(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-transparent text-sm text-foreground outline-none transition-all appearance-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="" disabled>Select civil status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-voterStatus" className="text-sm font-medium text-gray-700">
                  Voter Status
                </Label>
                <div className="relative">
                  <Vote className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    id="edit-voterStatus"
                    value={voterStatus}
                    onChange={(e) => setVoterStatus(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select voter status</option>
                    <option value="Registered">Registered</option>
                    <option value="Not Registered">Not Registered</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !hasChanges || !!householdNumberError || !!purokError}
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
