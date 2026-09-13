"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCog,
  ArrowLeft,
  Loader2,
  Save,
  Lock,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import useUserStore from "@/app/store/useUserStore";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { successAlert, errorAlert } from "@/app/utils/alert";

interface ApiError {
  response?: { data?: { message?: string } };
}

export default function Page() {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const accountId = user?._id ?? "";

  const [info, setInfo] = useState({
    name: user?.name ?? "",
    address: user?.address ?? "",
    contact: user?.contact ?? "",
    email: user?.email ?? "",
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const [pass, setPass] = useState({ oldPassword: "", newPassword: "" });
  const [savingPass, setSavingPass] = useState(false);

  const setInfoField = (key: keyof typeof info, value: string) =>
    setInfo((s) => ({ ...s, [key]: value }));

  const saveInfo = async () => {
    if (!accountId) return;
    setSavingInfo(true);
    try {
      const res = await axiosInstance.patch(`/account/${accountId}/info`, {
        name: info.name,
        address: info.address,
        contact: info.contact,
      });
      successAlert("Profile updated.");
      if (res.data?.name && user) setUser({ ...user, name: res.data.name });
    } catch (e) {
      errorAlert((e as ApiError)?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSavingInfo(false);
    }
  };

  const savePassword = async () => {
    if (!accountId) {
      errorAlert("Account not loaded.");
      return;
    }
    if (!pass.oldPassword || !pass.newPassword) {
      errorAlert("Both password fields are required.");
      return;
    }
    setSavingPass(true);
    try {
      await axiosInstance.patch(`/account/${accountId}/password`, pass);
      setPass({ oldPassword: "", newPassword: "" });
      successAlert("Password changed.");
    } catch (e) {
      errorAlert((e as ApiError)?.response?.data?.message || "Failed to change password.");
    } finally {
      setSavingPass(false);
    }
  };

  const uploadPic = async (file: File | null) => {
    if (!accountId || !file) return;
    const formData = new FormData();
    formData.append("profile", file);
    try {
      const res = await axiosInstance.put(`/account/${accountId}/profile-pic`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.profile && user) setUser({ ...user, profile: res.data.profile });
      successAlert("Profile picture updated.");
    } catch (e) {
      errorAlert((e as ApiError)?.response?.data?.message || "Failed to upload profile picture.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <UserCog className="mr-2 inline size-6 text-sky-600" />
          Account Settings
        </h1>
        <p className="text-sm text-slate-500">
          Update your profile, contact details, profile picture, and password.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <ImageIcon className="size-4 text-sky-600" /> Profile Picture
        </h2>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user?.profile || "/default-avatar.png"}
            alt="Profile"
            className="size-16 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => uploadPic(e.target.files?.[0] || null)}
              className="max-w-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP up to 10 MB.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <RefreshCw className="size-4 text-sky-600" /> Personal Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={info.name} onChange={(e) => setInfoField("name", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={info.email} readOnly className="bg-slate-50 text-slate-500" />
          </div>
          <div className="grid gap-2">
            <Label>Address</Label>
            <Input value={info.address} onChange={(e) => setInfoField("address", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Contact</Label>
            <Input value={info.contact} onChange={(e) => setInfoField("contact", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveInfo} disabled={savingInfo}>
            {savingInfo ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Information
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <Lock className="size-4 text-sky-600" /> Change Password
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Current Password</Label>
            <Input type="password" value={pass.oldPassword} onChange={(e) => setPass((s) => ({ ...s, oldPassword: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>New Password</Label>
            <Input type="password" value={pass.newPassword} onChange={(e) => setPass((s) => ({ ...s, newPassword: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={savePassword} disabled={savingPass}>
            {savingPass ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}