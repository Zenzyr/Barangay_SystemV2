"use client";

import { useState, useEffect } from "react";
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
  currentAddress: string;
  currentContact: string;
  currentGender: string;
  currentDateOfBirth: string;
  currentCivilStatus: string;
  currentPurok: string;
  currentVoterStatus: string;
  currentHouseHoldNumber: string;
  onSave: (data: {
    name: string;
    address: string;
    contact: string;
    gender: string;
    dateOfBirth: string;
    civilStatus: string;
    purok: string;
    voterStatus: string;
    houseHoldNumber: string;
  }) => Promise<void>;
}

export default function EditProfileModal({
  open,
  onOpenChange,
  currentName,
  currentAddress,
  currentContact,
  currentGender,
  currentDateOfBirth,
  currentCivilStatus,
  currentPurok,
  currentVoterStatus,
  currentHouseHoldNumber,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(currentName);
  const [address, setAddress] = useState(currentAddress);
  const [contact, setContact] = useState(currentContact);
  const [gender, setGender] = useState(currentGender);
  const [dateOfBirth, setDateOfBirth] = useState(currentDateOfBirth);
  const [civilStatus, setCivilStatus] = useState(currentCivilStatus);
  const [purok, setPurok] = useState(currentPurok);
  const [voterStatus, setVoterStatus] = useState(currentVoterStatus);
  const [houseHoldNumber, setHouseHoldNumber] = useState(currentHouseHoldNumber);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(currentName);
    setAddress(currentAddress);
    setContact(currentContact);
    setGender(currentGender);
    setDateOfBirth(currentDateOfBirth);
    setCivilStatus(currentCivilStatus);
    setPurok(currentPurok);
    setVoterStatus(currentVoterStatus);
    setHouseHoldNumber(currentHouseHoldNumber);
  }, [
    currentName,
    currentAddress,
    currentContact,
    currentGender,
    currentDateOfBirth,
    currentCivilStatus,
    currentPurok,
    currentVoterStatus,
    currentHouseHoldNumber,
    open,
  ]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        address: address.trim(),
        contact: contact.trim(),
        gender,
        dateOfBirth,
        civilStatus,
        purok,
        voterStatus,
        houseHoldNumber,
      });
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    name !== currentName ||
    address !== currentAddress ||
    contact !== currentContact ||
    gender !== currentGender ||
    dateOfBirth !== currentDateOfBirth ||
    civilStatus !== currentCivilStatus ||
    purok !== currentPurok ||
    voterStatus !== currentVoterStatus ||
    houseHoldNumber !== currentHouseHoldNumber;

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
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">
                  Full Name
                </Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="Your full name"
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

          {/* Address & Purok */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-emerald-400" />
              Address & Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-address" className="text-sm font-medium text-gray-700">
                  Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="Your address"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-purok" className="text-sm font-medium text-gray-700">
                  Purok
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    id="edit-purok"
                    value={purok}
                    onChange={(e) => setPurok(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select purok</option>
                    <option value="Purok 1">Purok 1</option>
                    <option value="Purok 2">Purok 2</option>
                    <option value="Purok 3">Purok 3</option>
                    <option value="Purok 4">Purok 4</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-houseHoldNumber" className="text-sm font-medium text-gray-700">
                  Household Number
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="edit-houseHoldNumber"
                    value={houseHoldNumber}
                    onChange={(e) => setHouseHoldNumber(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="e.g. HH-001"
                  />
                </div>
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
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all appearance-none cursor-pointer"
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
            disabled={loading || !name.trim() || !hasChanges}
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
