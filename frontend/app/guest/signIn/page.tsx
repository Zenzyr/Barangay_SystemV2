"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { errorAlert, successAlert } from "@/app/utils/alert";
import {
  LogIn,
  Mail,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Smartphone,
} from "lucide-react";

type ForgotStep = "email" | "code" | "newPassword" | "done";
type ResetDelivery = "email" | "sms";

type ApiError = { response?: { data?: unknown }; message?: string };

export default function SignInPage() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password flow
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [forgotMethod, setForgotMethod] = useState<ResetDelivery>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotContact, setForgotContact] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const openForgotPassword = () => {
    setForgotStep("email");
    setForgotMethod("email");
    setForgotEmail(email);
    setForgotContact("");
    setResetCode("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
    setForgotOpen(true);
  };

  const handleSendCode = async () => {
    if (forgotMethod === "sms") {
      if (forgotContact.replace(/\D/g, "").length < 10) {
        errorAlert("Enter your registered mobile number");
        return;
      }
    } else if (!forgotEmail.trim()) {
      errorAlert("Please enter your email address");
      return;
    }
    setForgotBusy(true);
    try {
      await axiosInstance.post("/account/forgot-password", {
        method: forgotMethod,
        ...(forgotMethod === "sms"
          ? { contact: forgotContact.trim() }
          : { email: forgotEmail.trim() }),
      });
      successAlert("Reset code sent");
      setForgotStep("code");
    } catch {
      errorAlert("Failed to send reset code. Please try again.");
    } finally {
      setForgotBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (resetCode.trim().length !== 6) {
      errorAlert("Enter the 6-digit code");
      return;
    }
    setForgotBusy(true);
    try {
      const res = await axiosInstance.post("/account/verify-reset-code", {
        method: forgotMethod,
        ...(forgotMethod === "sms"
          ? { contact: forgotContact.trim() }
          : { email: forgotEmail.trim() }),
        code: resetCode.trim(),
      });
      setResetToken(res.data.resetToken);
      setForgotStep("newPassword");
    } catch (err) {
      const message = (err as ApiError)?.response?.data || "Invalid or expired code";
      errorAlert(typeof message === "string" ? message : "Invalid or expired code");
    } finally {
      setForgotBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      errorAlert("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      errorAlert("Password must include an uppercase letter (A-Z)");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      errorAlert("Password must include a lowercase letter (a-z)");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      errorAlert("Password must include a number (0-9)");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errorAlert("Password must include a special character");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      errorAlert("Passwords do not match");
      return;
    }
    setForgotBusy(true);
    try {
      await axiosInstance.post("/account/reset-password", { resetToken, newPassword });
      setForgotStep("done");
    } catch (err) {
      const message = (err as ApiError)?.response?.data || "Failed to reset password. Please try again.";
      errorAlert(typeof message === "string" ? message : "Failed to reset password");
    } finally {
      setForgotBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      errorAlert("Please enter your email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await axiosInstance.post("/account/login", { email, password });
      const { account, token } = res.data;

      // Store token in localStorage (used by axios interceptor)
      localStorage.setItem("token", token);

      // Store user data in zustand persist store (saved to localStorage)
      setUser(account);

      // Navigate by role returned from the server (never trust the client)
      if (account?.role === "super_admin") {
        router.push("/pages/superadmin/home");
      } else if (account?.role === "secretary") {
        router.push("/pages/secretary/home");
      } else {
        router.push("/pages/resident/home");
      }
    } catch (err) {
      const message =
        (err as ApiError)?.response?.data || (err as ApiError)?.message || "Login failed";
      errorAlert(typeof message === "string" ? message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-sky-600 transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/assets/logo.jpg"
                alt="Barangay Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                Barangay Rabon
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative w-full max-w-md">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-3 size-16 overflow-hidden rounded-2xl shadow-lg shadow-sky-200/40 ring-2 ring-sky-200/60">
              <Image
                src="/assets/logo.jpg"
                alt="Barangay Logo"
                fill
                sizes="64px"
                loading="eager"
                className="object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to continue to Barangay Rabon
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-card p-8">
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-white/60 backdrop-blur-sm border-gray-200/50 focus:border-sky-400 focus:ring-sky-400/20 transition-all rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-white/60 backdrop-blur-sm border-gray-200/50 focus:border-sky-400 focus:ring-sky-400/20 transition-all rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign In
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    or
                  </span>
                </div>
              </div>

              {/* Register link */}
              <p className="text-center text-sm text-gray-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/guest/signUp"
                  className="font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Create one
                </Link>
              </p>

              {/* Forgot password link */}
              <p className="text-center -mt-2">
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Forgot password?
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm glass-card border-none">
          {forgotStep === "email" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-sky-600" />
                  Reset your password
                </DialogTitle>
                <DialogDescription>
                  {forgotMethod === "sms"
                    ? "Enter the mobile number registered to your account and we&apos;ll text you a 6-digit code."
                    : "Enter your account email and we&apos;ll send you a 6-digit code to reset your password."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {forgotMethod === "sms" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="forgotContact" className="text-sm font-medium text-gray-700">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        id="forgotContact"
                        type="tel"
                        inputMode="numeric"
                        placeholder="09171234567"
                        value={forgotContact}
                        onChange={(e) => setForgotContact(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
                        onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                        className="pl-10 h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="forgotEmail" className="text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        id="forgotEmail"
                        type="email"
                        placeholder="juan@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                        className="pl-10 h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Send code via</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotMethod("email")}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        forgotMethod === "email"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600"
                      }`}
                    >
                      <Mail className="size-4" />
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setForgotMethod("sms")}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        forgotMethod === "sms"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600"
                      }`}
                    >
                      <Smartphone className="size-4" />
                      SMS
                    </button>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSendCode}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? <Loader2 className="size-4 animate-spin" /> : <>Send Reset Code <ArrowRight className="size-4" /></>}
              </Button>
            </>
          )}

          {forgotStep === "code" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-sky-600" />
                  Enter the code
                </DialogTitle>
                <DialogDescription>
                  {forgotMethod === "sms"
                    ? "We texted a 6-digit code to your registered mobile number. It expires in 10 minutes."
                    : `We sent a 6-digit code to ${forgotEmail}. It expires in 10 minutes.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-2">
                <Label htmlFor="resetCode" className="text-sm font-medium text-gray-700">
                  6-Digit Code
                </Label>
                <Input
                  id="resetCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  className="h-12 text-center text-2xl tracking-[0.5em] border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                />
              </div>
              <Button
                onClick={handleVerifyCode}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? <Loader2 className="size-4 animate-spin" /> : <>Verify Code <ArrowRight className="size-4" /></>}
              </Button>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={forgotBusy}
                className="text-xs text-sky-600 hover:text-sky-700 text-center w-full mt-1"
              >
                Didn&apos;t get a code? Resend
              </button>
            </>
          )}

          {forgotStep === "newPassword" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="size-5 text-sky-600" />
                  Set a new password
                </DialogTitle>
                <DialogDescription>Choose a new password for your account.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Min. 8 characters with uppercase, number & symbol"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {[
                      { label: "At least 8 characters", ok: newPassword.length >= 8 },
                      { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(newPassword) },
                      { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(newPassword) },
                      { label: "Number (0-9)", ok: /[0-9]/.test(newPassword) },
                      { label: "Special character (!@#$...)", ok: /[^A-Za-z0-9]/.test(newPassword) },
                    ].map((check) => (
                      <li
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
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-gray-700">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                    className="h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                  />
                </div>
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? <Loader2 className="size-4 animate-spin" /> : "Reset Password"}
              </Button>
            </>
          )}

          {forgotStep === "done" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                  Password reset!
                </DialogTitle>
                <DialogDescription>
                  Your password has been changed. You can now sign in with your new password.
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={() => {
                  setForgotOpen(false);
                  setEmail(forgotEmail);
                }}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                Back to Sign In
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

