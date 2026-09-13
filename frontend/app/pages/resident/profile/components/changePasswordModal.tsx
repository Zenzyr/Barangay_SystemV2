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
import { Loader2, Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import useUserStore from "@/app/store/useUserStore";
import { errorAlert } from "@/app/utils/alert";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangePassword: (data: { oldPassword: string; newPassword: string }) => Promise<void>;
}

export default function ChangePasswordModal({
  open,
  onOpenChange,
  onChangePassword,
}: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const {user} = useUserStore()

  const resetForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const newPasswordValid =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword);

  const handleSubmit = async () => {
    if (!oldPassword) return;
    if (newPassword.length < 8) return errorAlert("Password must be at least 8 characters");
    if (!/[A-Z]/.test(newPassword)) return errorAlert("Password must include an uppercase letter (A-Z)");
    if (!/[a-z]/.test(newPassword)) return errorAlert("Password must include a lowercase letter (a-z)");
    if (!/[0-9]/.test(newPassword)) return errorAlert("Password must include a number (0-9)");
    if (!/[^A-Za-z0-9]/.test(newPassword)) return errorAlert("Password must include a special character");
    if (newPassword !== confirmPassword) return errorAlert("New password and confirm password must match");

    setLoading(true);
    try {
      await onChangePassword({ oldPassword, newPassword });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
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
                <KeyRound className="size-5 text-sky-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Change Password
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Enter your old password and a new password
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {/* Old Password */}
          <div className="space-y-1.5">
            <Label htmlFor="old-password" className="text-sm font-medium text-gray-700">
              Current Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
              <Input
                id="old-password"
                type={showOld ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="pl-10 pr-10 h-10 border-gray-200 focus:border-sky-400"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showOld ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10 h-10 border-gray-200 focus:border-sky-400"
                placeholder="Min. 8 characters with uppercase, number & symbol"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-10 border-gray-200 focus:border-sky-400"
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs">
            {[
              { label: "At least 8 characters", ok: newPassword.length >= 8 },
              { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(newPassword) },
              { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(newPassword) },
              { label: "Number (0-9)", ok: /[0-9]/.test(newPassword) },
              { label: "Special character (!@#$...)", ok: /[^A-Za-z0-9]/.test(newPassword) },
            ].map((check) => (
              <p
                key={check.label}
                className={`flex items-center gap-1.5 text-xs ${
                  check.ok ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {check.ok ? (
                  <CheckCircle2 className="size-3 shrink-0" />
                ) : (
                  <span className="size-3 shrink-0 rounded-full border border-gray-300" />
                )}
                {check.label}
              </p>
            ))}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="flex items-center gap-1.5 text-xs text-rose-500">
                <span className="size-3 shrink-0 rounded-full border border-gray-300" />
                Passwords do not match
              </p>
            )}
          </div>
        </div>

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
              !oldPassword ||
              !newPassword ||
              !newPasswordValid ||
              !confirmPassword ||
              newPassword !== confirmPassword
            }
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                Change Password
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
