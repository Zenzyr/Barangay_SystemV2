"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, ArrowLeft, Loader2, Save, Lock, RefreshCw } from "lucide-react";
import useUserStore from "@/app/store/useUserStore";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { successAlert, errorAlert } from "@/app/utils/alert";

interface ApiError {
  response?: { data?: string | { message?: string } };
}

const messageFrom = (e: unknown, fallback: string) => {
  const data = (e as ApiError)?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || fallback;
};

export function AccountSettings({
  backHref,
  backLabel = "Back",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const accountId = user?._id ?? "";

  const [info, setInfo] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const [pass, setPass] = useState({ oldPassword: "", newPassword: "", otp: "" });
  const [savingPass, setSavingPass] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const setInfoField = (key: keyof typeof info, value: string) =>
    setInfo((s) => ({ ...s, [key]: value }));

  const saveInfo = async () => {
    if (!accountId) return;
    setSavingInfo(true);
    try {
      const res = await axiosInstance.patch(`/account/${accountId}/info`, {
        name: info.name,
      });
      successAlert("Profile updated.");
      if (res.data?.name && user) setUser({ ...user, name: res.data.name });
    } catch (e) {
      errorAlert(messageFrom(e, "Failed to update profile."));
    } finally {
      setSavingInfo(false);
    }
  };

  const sendPasswordOtp = async () => {
    if (!accountId) {
      errorAlert("Account not loaded.");
      return;
    }
    setSendingOtp(true);
    try {
      await axiosInstance.post(`/account/${accountId}/password-otp`);
      successAlert("A verification code was sent to your email.");
    } catch (e) {
      errorAlert(messageFrom(e, "Failed to send the verification code."));
    } finally {
      setSendingOtp(false);
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
    if (!pass.otp.trim()) {
      errorAlert("Enter the verification code sent to your email.");
      return;
    }
    setSavingPass(true);
    try {
      await axiosInstance.patch(`/account/${accountId}/password`, pass);
      setPass({ oldPassword: "", newPassword: "", otp: "" });
      successAlert("Password changed.");
    } catch (e) {
      errorAlert(messageFrom(e, "Failed to change password."));
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        {backHref && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-slate-500"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="size-4" /> {backLabel}
          </Button>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <UserCog className="mr-2 inline size-6 text-sky-600" />
          Account Settings
        </h1>
        <p className="text-sm text-slate-500">Update your display name and password.</p>
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
          <div className="grid gap-2 sm:col-span-2">
            <Label>Email Verification Code</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={pass.otp}
                onChange={(e) => setPass((s) => ({ ...s, otp: e.target.value }))}
                className="max-w-40"
              />
              <Button type="button" variant="outline" onClick={sendPasswordOtp} disabled={sendingOtp}>
                {sendingOtp ? <Loader2 className="size-4 animate-spin" /> : null}
                Send Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We&apos;ll email a one-time code to your registered address to confirm the change.
            </p>
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
