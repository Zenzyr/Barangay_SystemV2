"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert } from "@/app/utils/alert";
import AddSkillModal from "./components/addSkillModal";
import EditProfileModal from "./components/editProfileModal";
import ChangePasswordModal from "./components/changePasswordModal";
import {
  UserRound,
  Mail,
  MapPin,
  Briefcase,
  Plus,
  Trash2,
  Clock,
  BadgeCheck,
  Star,
  Camera,
  Pencil,
  KeyRound,
  Phone,
  Loader2,
  CalendarDays,
  Users,
  Heart,
  Hash,
  Vote,
} from "lucide-react";

interface Skill {
  _id: string;
  skill: string;
  experience: number;
  proficiency: string;
  serviceTypes?: string[];
}

interface Account {
  _id: string;
  name: string;
  address: string;
  email: string;
  contact: string;
  profile: string;
  status: string;
  skills: Skill[];
  gender: string;
  dateOfBirth: string;
  civilStatus: string;
  purok: string;
  voterStatus: string;
  houseHoldNumber: string;
  availability?: "AVAILABLE" | "BUSY" | "NOT_AVAILABLE";
  completedServices?: number;
}

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, setUser } = useUserStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Fetch profile
  const { data: profile, isLoading } = useQuery<Account>({
    queryKey: ["profile", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/account/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // Upload profile picture
  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      errorAlert("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorAlert("Image must be less than 5MB");
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append("profilePic", file);

      const res = await axiosInstance.put(
        `/account/${user?._id}/profile-pic`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setUser(res.data);
      successAlert("Profile picture updated!");
    } catch (err) {
      const message = (err as ApiError)?.response?.data || (err as ApiError)?.message || "Upload failed";
      errorAlert(typeof message === "string" ? message : "Upload failed");
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Update info mutation
  const updateInfoMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      address: string;
      contact: string;
      gender: string;
      dateOfBirth: string;
      civilStatus: string;
      purok: string;
      voterStatus: string;
      houseHoldNumber: string;
    }) => {
      const res = await axiosInstance.patch(`/account/${user?._id}/info`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setUser(data);
      successAlert("Profile updated successfully!");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Update failed";
      errorAlert(typeof message === "string" ? message : "Update failed");
      throw err;
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      await axiosInstance.patch(`/account/${user?._id}/password`, data);
    },
    onSuccess: () => {
      successAlert("Password changed successfully!");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Failed to change password";
      errorAlert(typeof message === "string" ? message : "Failed to change password");
      throw err;
    },
  });

  // Availability mutation (provider marketplace status)
  const availabilityMutation = useMutation({
    mutationFn: async (availability: "AVAILABLE" | "NOT_AVAILABLE") => {
      const res = await axiosInstance.patch(`/account/${user?._id}/availability`, { availability });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      successAlert("Availability updated");
    },
    onError: () => errorAlert("Failed to update availability"),
  });

  // Add skill mutation
  const addSkillMutation = useMutation({
    mutationFn: async (skill: {
      skill: string;
      experience: number;
      proficiency: string;
      serviceTypes: string[];
    }) => {
      const res = await axiosInstance.post(`/account/${user?._id}/skills`, skill);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      successAlert("Skill added successfully!");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Failed to add skill";
      errorAlert(typeof message === "string" ? message : "Failed to add skill");
    },
  });

  // Remove skill mutation
  const removeSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      const res = await axiosInstance.delete(
        `/account/${user?._id}/skills/${skillId}`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      successAlert("Skill removed");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Failed to remove skill";
      errorAlert(typeof message === "string" ? message : "Failed to remove skill");
    },
  });

  const skills = profile?.skills || [];

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
          <UserRound className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            My Profile
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View your information and manage your skills
          </p>
        </div>
      </div>

      {/* Profile Info Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : profile ? (
          <div className="p-6">
            {/* Profile Picture + Name */}
            <div className="flex flex-col sm:flex-row items-start gap-5 mb-6">
              <div className="relative group shrink-0">
                <div className="size-20 rounded-2xl overflow-hidden border-2 border-sky-100 bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  {profile.profile ? (
                    <img
                      src={profile.profile}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserRound className="size-9 text-sky-600" />
                  )}
                </div>
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPic}
                  className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white border-2 border-sky-200 shadow-sm flex items-center justify-center text-sky-500 hover:text-sky-700 hover:border-sky-400 transition-all hover:shadow-md disabled:opacity-50"
                >
                  {uploadingPic ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Camera className="size-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePicUpload}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {profile.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 mt-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <BadgeCheck className="size-3" />
                      {profile.status}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPasswordModalOpen(true)}
                      className="h-8 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <KeyRound className="size-3.5" />
                      <span className="hidden sm:inline">Password</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEditModalOpen(true)}
                      className="h-8 text-xs bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-sm"
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Mail className="size-4 text-sky-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Email</p>
                  <p className="text-sm text-gray-800 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Phone className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Contact</p>
                  <p className="text-sm text-gray-800 truncate">
                    {profile.contact || "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 sm:col-span-2">
                <MapPin className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Address</p>
                  <p className="text-sm text-gray-800">{profile.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Users className="size-4 text-sky-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                  <p className="text-sm text-gray-800 capitalize">{profile.gender || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <CalendarDays className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                  <p className="text-sm text-gray-800">{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Heart className="size-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Civil Status</p>
                  <p className="text-sm text-gray-800">{profile.civilStatus || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <MapPin className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Purok</p>
                  <p className="text-sm text-gray-800">{profile.purok || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Vote className="size-4 text-violet-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Voter Status</p>
                  <p className="text-sm text-gray-800">{profile.voterStatus || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <Hash className="size-4 text-teal-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Household Number</p>
                  <p className="text-sm text-gray-800">{profile.houseHoldNumber || "Not set"}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400">Failed to load profile</div>
        )}
      </div>

      {/* Provider Availability */}
      {skills.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`size-2.5 rounded-full ${
                profile?.availability === "BUSY"
                  ? "bg-amber-400"
                  : profile?.availability === "NOT_AVAILABLE"
                  ? "bg-red-400"
                  : "bg-emerald-400"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Service Availability:{" "}
                <span
                  className={
                    profile?.availability === "BUSY"
                      ? "text-amber-600"
                      : profile?.availability === "NOT_AVAILABLE"
                      ? "text-red-600"
                      : "text-emerald-600"
                  }
                >
                  {profile?.availability === "BUSY"
                    ? "Busy (active service)"
                    : profile?.availability === "NOT_AVAILABLE"
                    ? "Not Available"
                    : "Available"}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {profile?.availability === "BUSY"
                  ? "This updates automatically once your current service is completed."
                  : "Controls whether neighbors can request your services right now."}
              </p>
            </div>
          </div>
          {profile?.availability !== "BUSY" && (
            <Button
              variant="outline"
              size="sm"
              disabled={availabilityMutation.isPending}
              onClick={() =>
                availabilityMutation.mutate(profile?.availability === "NOT_AVAILABLE" ? "AVAILABLE" : "NOT_AVAILABLE")
              }
              className="h-8 text-xs border-gray-200"
            >
              {availabilityMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : profile?.availability === "NOT_AVAILABLE" ? (
                "Mark as Available"
              ) : (
                "Mark as Not Available"
              )}
            </Button>
          )}
        </div>
      )}

      {/* Skills Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-gray-900">My Skills</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {skills.length}
            </span>
          </div>
          <Button
            onClick={() => setSkillModalOpen(true)}
            disabled={addSkillMutation.isPending}
            className="h-8 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white text-xs font-medium rounded-lg shadow-sm transition-all"
          >
            <Plus className="size-3.5" />
            Add Skill
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="p-12 text-center">
            <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="size-5" />
            </div>
            <p className="text-sm font-medium text-gray-500">No skills yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add your skills so neighbors can find and hire you
            </p>
            <Button
              onClick={() => setSkillModalOpen(true)}
              variant="outline"
              className="mt-4 h-8 text-xs border-sky-200 text-sky-600 hover:bg-sky-50"
            >
              <Plus className="size-3.5" />
              Add Your First Skill
            </Button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            {skills.map((skill) => (
              <div
                key={skill._id}
                className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all duration-200"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="size-3.5 text-amber-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {skill.skill}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                      {skill.proficiency}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 ml-5">
                    <Clock className="size-3" />
                    <span>{skill.experience} {skill.experience === 1 ? "year" : "years"} of experience</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSkillMutation.mutate(skill._id)}
                  disabled={removeSkillMutation.isPending}
                  className="size-8 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddSkillModal
        open={skillModalOpen}
        onOpenChange={setSkillModalOpen}
        onAdd={async (skill) => {
          await addSkillMutation.mutateAsync(skill);
        }}
      />

      <EditProfileModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        currentName={profile?.name || ""}
        currentAddress={profile?.address || ""}
        currentContact={profile?.contact || ""}
        currentGender={profile?.gender || ""}
        currentDateOfBirth={profile?.dateOfBirth || ""}
        currentCivilStatus={profile?.civilStatus || ""}
        currentPurok={profile?.purok || ""}
        currentVoterStatus={profile?.voterStatus || ""}
        currentHouseHoldNumber={profile?.houseHoldNumber || ""}
        onSave={async (data) => {
          await updateInfoMutation.mutateAsync(data);
        }}
      />

      <ChangePasswordModal
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        onChangePassword={async (data) => {
          await changePasswordMutation.mutateAsync(data);
        }}
      />
    </div>
  );
}
