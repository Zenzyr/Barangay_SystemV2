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
  Loader2,
  ShieldCheck,
  ShieldOff,
  Lock,
  KeyRound,
  CheckCircle2,
  Copy,
} from "lucide-react";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";

interface TwoFactorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  onChanged: () => void;
}

interface ApiError {
  response?: { status?: number; data?: unknown };
  message?: string;
}

type PendingAction = "disable" | "regenerate" | null;
type Step = "overview" | "enableVerify" | "recovery";

export default function TwoFactorModal({
  open,
  onOpenChange,
  enabled,
  onChanged,
}: TwoFactorModalProps) {
  const [step, setStep] = useState<Step>("overview");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const reset = () => {
    setStep("overview");
    setBusy(false);
    setCode("");
    setPassword("");
    setPendingAction(null);
    setRecoveryCodes([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const errMessage = (err: unknown, fallback: string) => {
    const data = (err as ApiError)?.response?.data;
    if (typeof data === "string") return data;
    return (err as ApiError)?.message || fallback;
  };

  // Step 1 of enabling: email a setup code to the account owner.
  const startEnable = async () => {
    setBusy(true);
    try {
      await axiosInstance.post("/account/2fa/setup");
      setStep("enableVerify");
      setCode("");
    } catch (err) {
      errorAlert(errMessage(err, "Could not start two-factor setup"));
    } finally {
      setBusy(false);
    }
  };

  // Step 2 of enabling: confirm the code and reveal recovery codes once.
  const confirmEnable = async () => {
    if (!code.trim()) {
      errorAlert("Please enter the verification code");
      return;
    }
    setBusy(true);
    try {
      const res = await axiosInstance.post("/account/2fa/enable", {
        code: code.trim(),
      });
      setRecoveryCodes(res.data?.recoveryCodes || []);
      setStep("recovery");
      onChanged();
    } catch (err) {
      errorAlert(errMessage(err, "Could not enable two-factor authentication"));
    } finally {
      setBusy(false);
    }
  };

  const submitPasswordAction = async () => {
    if (!password) {
      errorAlert("Please enter your password");
      return;
    }
    setBusy(true);
    try {
      if (pendingAction === "disable") {
        await axiosInstance.post("/account/2fa/disable", { password });
        successAlert("Two-factor authentication disabled");
        onChanged();
        handleOpenChange(false);
      } else if (pendingAction === "regenerate") {
        const res = await axiosInstance.post("/account/2fa/recovery-codes", {
          password,
        });
        setRecoveryCodes(res.data?.recoveryCodes || []);
        setPassword("");
        setPendingAction(null);
        setStep("recovery");
        successAlert("New recovery codes generated");
      }
    } catch (err) {
      errorAlert(errMessage(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      successAlert("Recovery codes copied");
    } catch {
      errorAlert("Could not copy. Please save them manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 gap-0">
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                <ShieldCheck className="size-5 text-sky-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Two-Factor Authentication
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Add a second step when signing in
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {step === "overview" && pendingAction === null && (
            <>
              <p className="text-sm text-gray-600">
                {enabled
                  ? "Two-factor authentication is currently enabled. You'll be asked for a code emailed to you each time you sign in."
                  : "When enabled, you'll enter a one-time code emailed to you each time you sign in. This helps protect your account even if your password is stolen."}
              </p>

              {!enabled ? (
                <Button
                  type="button"
                  onClick={startEnable}
                  disabled={busy}
                  className="w-full h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Enable Two-Factor Authentication
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPendingAction("regenerate")}
                    className="w-full h-10 border-gray-200 text-gray-700"
                  >
                    <KeyRound className="size-4" />
                    Regenerate Recovery Codes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPendingAction("disable")}
                    className="w-full h-10 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <ShieldOff className="size-4" />
                    Disable Two-Factor Authentication
                  </Button>
                </div>
              )}
            </>
          )}

          {step === "enableVerify" && (
            <>
              <DialogDescription className="text-sm text-gray-500">
                We sent a verification code to your account email. Enter it below
                to confirm.
              </DialogDescription>
              <div className="space-y-1.5">
                <Label htmlFor="tfa-code" className="text-sm font-medium text-gray-700">
                  Verification code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="tfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("overview")}
                  className="h-9 border-gray-200 text-gray-600"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={confirmEnable}
                  disabled={busy || !code.trim()}
                  className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Verify & Enable
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "recovery" && (
            <>
              <DialogDescription className="text-sm text-gray-500">
                Save these one-time recovery codes somewhere safe. Each can be
                used once to sign in if you can&apos;t access your email. They
                won&apos;t be shown again.
              </DialogDescription>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                {recoveryCodes.map((rc) => (
                  <code
                    key={rc}
                    className="text-sm font-mono text-gray-800 tracking-wide"
                  >
                    {rc}
                  </code>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyCodes}
                  className="h-9 border-gray-200 text-gray-600"
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
                <Button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium"
                >
                  <CheckCircle2 className="size-4" />
                  Done
                </Button>
              </div>
            </>
          )}

          {pendingAction !== null && (
            <>
              <DialogDescription className="text-sm text-gray-500">
                {pendingAction === "disable"
                  ? "Enter your password to disable two-factor authentication."
                  : "Enter your password to generate a new set of recovery codes."}
              </DialogDescription>
              <div className="space-y-1.5">
                <Label htmlFor="tfa-password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="tfa-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPendingAction(null);
                    setPassword("");
                  }}
                  className="h-9 border-gray-200 text-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitPasswordAction}
                  disabled={busy || !password}
                  className={`h-9 text-white font-medium ${
                    pendingAction === "disable"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600"
                  }`}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : pendingAction === "disable" ? (
                    "Disable"
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
