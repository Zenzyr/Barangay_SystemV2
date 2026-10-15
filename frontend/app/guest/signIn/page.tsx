"use client";

import { useState, useEffect, useCallback, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { accountInterface } from "@/app/types/account.type";
import { useBarangayLogo } from "@/app/hooks/useBarangayLogo";
import { homeForRole } from "@/lib/constants/roles";
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
  ShieldAlert,
  Clock,
} from "lucide-react";

type ForgotStep = "email" | "phone" | "code" | "newPassword" | "done";
type ResetDelivery = "email" | "sms";

type ApiError = {
  response?: { status?: number; data?: unknown };
  message?: string;
};
type LoginErrorPayload = {
  message?: string;
  locked?: boolean;
  lockedUntil?: string | null;
  attemptsRemaining?: number;
};

const LAST_LOGIN_EMAIL_KEY = "bims_last_login_email";

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Accepts 09XXXXXXXXX, +639XXXXXXXXX / 639XXXXXXXXX and 9XXXXXXXXX.
function isCompletePhMobile(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  return (
    (digits.length === 11 && digits.startsWith("09")) ||
    (digits.length === 12 && digits.startsWith("639")) ||
    (digits.length === 10 && digits.startsWith("9"))
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUserStore();
  const logoUrl = useBarangayLogo();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem(LAST_LOGIN_EMAIL_KEY) || "",
  );
  const [password, setPassword] = useState("");
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null,
  );
  const adminMode = searchParams.get("mode") === "admin";

  // Forgot password flow
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [forgotMethod, setForgotMethod] = useState<ResetDelivery>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  // Masked registered mobile (e.g. "09*******67") returned by the phone
  // challenge. Null when the account has no verifiable registered mobile.
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [phoneFull, setPhoneFull] = useState("");
  // Short-lived token proving the phone-verification step passed. Required by
  // POST /account/forgot-password for accounts that have a registered mobile.
  const [phoneToken, setPhoneToken] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  // Client-side resend guard for the reset code (mirrors the backend's 60s
  // per-account cooldown so the user can't hammer Send/Resend).
  const [resendSeconds, setResendSeconds] = useState(0);

  // Login second factor. Set once the first factor (email + password) passes
  // for a 2FA-enabled account; cleared after verification or cancellation.
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorResendSeconds, setTwoFactorResendSeconds] = useState(0);

  const applyLock = (ms: number | null) => {
    setLockedUntil(ms);
    setRemainingSeconds(
      ms ? Math.max(0, Math.ceil((ms - Date.now()) / 1000)) : 0,
    );
  };

  const checkLoginStatus = useCallback(async (candidateEmail: string) => {
    const trimmed = candidateEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    try {
      const res = await axiosInstance.get("/account/login-status", {
        params: { email: trimmed },
      });
      if (res.data?.locked && res.data?.lockedUntil) {
        applyLock(new Date(res.data.lockedUntil).getTime());
      } else {
        applyLock(null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const lastEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (lastEmail) {
      checkLoginStatus(lastEmail);
    }
  }, [checkLoginStatus]);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      setRemainingSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const interval = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendSeconds]);

  useEffect(() => {
    if (twoFactorResendSeconds <= 0) return;
    const interval = setInterval(() => {
      setTwoFactorResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [twoFactorResendSeconds]);

  const isLocked = remainingSeconds > 0;

  const openForgotPassword = () => {
    setForgotStep("email");
    setForgotMethod("email");
    setForgotEmail(email);
    setMaskedPhone(null);
    setPhoneFull("");
    setPhoneToken("");
    setResetCode("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResendSeconds(0);
    setForgotOpen(true);
  };

  // Requests the reset code for the already-verified account. `token` is the
  // phone-verification token, or "" for accounts with no registered mobile.
  const sendResetCode = async (token: string) => {
    await axiosInstance.post("/account/forgot-password", {
      method: forgotMethod,
      email: forgotEmail.trim(),
      ...(token ? { phoneToken: token } : {}),
    });
    setResendSeconds(60);
  };

  // Step 1: start the reset for the selected channel.
  //  - email: send the code straight to the address registered to the account.
  //  - sms:   require the registered-number digit check first (no auto-switch).
  const handleIdentify = async () => {
    if (!forgotEmail.trim()) {
      errorAlert("Please enter your email address");
      return;
    }
    setForgotBusy(true);
    try {
      if (forgotMethod === "email") {
        await sendResetCode("");
        successAlert("Reset code sent");
        setForgotStep("code");
        return;
      }
      const res = await axiosInstance.post(
        "/account/forgot-password/phone-challenge",
        { email: forgotEmail.trim() },
      );
      const mask: string | null = res.data?.maskedPhone ?? null;
      setMaskedPhone(mask);
      if (!mask) {
        // No registered mobile on file: never silently switch to email.
        errorAlert(
          "SMS reset isn't available for that account. Please use Email instead.",
        );
        return;
      }
      setForgotStep("phone");
    } catch (err) {
      const message = (err as ApiError)?.response?.data;
      errorAlert(
        typeof message === "string" && message
          ? message
          : "Failed to start reset. Please try again.",
      );
    } finally {
      setForgotBusy(false);
    }
  };

  // Step 2: verify the complete registered mobile number against the account.
  const handleVerifyPhone = async () => {
    if (!isCompletePhMobile(phoneFull)) {
      errorAlert(
        "Enter your complete registered mobile number (e.g. 09171234594)",
      );
      return;
    }
    setForgotBusy(true);
    try {
      const res = await axiosInstance.post(
        "/account/forgot-password/verify-phone",
        {
          email: forgotEmail.trim(),
          phone: phoneFull.trim(),
        },
      );
      const token: string = res.data?.phoneToken ?? "";
      setPhoneToken(token);
      await sendResetCode(token);
      successAlert("Reset code sent");
      setForgotStep("code");
    } catch (err) {
      const message = (err as ApiError)?.response?.data;
      errorAlert(
        typeof message === "string" && message
          ? message
          : "We couldn't verify those details. Please check and try again.",
      );
    } finally {
      setForgotBusy(false);
    }
  };

  const handleSendCode = async () => {
    setForgotBusy(true);
    try {
      await sendResetCode(phoneToken);
      successAlert("Reset code sent");
    } catch (err) {
      const message = (err as ApiError)?.response?.data;
      errorAlert(
        typeof message === "string" && message
          ? message
          : "Failed to send reset code. Please try again.",
      );
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
        email: forgotEmail.trim(),
        method: forgotMethod,
        code: resetCode.trim(),
      });
      setResetToken(res.data.resetToken);
      setForgotStep("newPassword");
    } catch (err) {
      const message =
        (err as ApiError)?.response?.data || "Invalid or expired code";
      errorAlert(
        typeof message === "string" ? message : "Invalid or expired code",
      );
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
      await axiosInstance.post("/account/reset-password", {
        resetToken,
        newPassword,
      });
      setForgotStep("done");
    } catch (err) {
      const message =
        (err as ApiError)?.response?.data ||
        "Failed to reset password. Please try again.";
      errorAlert(
        typeof message === "string" ? message : "Failed to reset password",
      );
    } finally {
      setForgotBusy(false);
    }
  };

  // Stores the session returned after the first OR second factor succeeds and
  // navigates by role.
  const completeSignIn = (account: accountInterface, token: string) => {
    // Store token in localStorage (used by axios interceptor)
    localStorage.setItem("token", token);
    // Store user data in zustand persist store (saved to localStorage)
    setUser(account);
    localStorage.removeItem(LAST_LOGIN_EMAIL_KEY);
    setAttemptsRemaining(null);
    // Navigate by role returned from the server (never trust the client)
    router.push(homeForRole(account?.role));
  };

  const cancelTwoFactor = () => {
    setTwoFactorToken("");
    setTwoFactorEmail("");
    setTwoFactorCode("");
    setTwoFactorResendSeconds(0);
    setLoading(false);
  };

  // Second step of login for 2FA-enabled accounts.
  const handleVerifyTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      errorAlert("Please enter your verification code");
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post("/account/login/verify-2fa", {
        twoFactorToken,
        code: twoFactorCode.trim(),
      });
      completeSignIn(res.data.account, res.data.token);
    } catch (err) {
      const status = (err as ApiError)?.response?.status;
      const data = (err as ApiError)?.response?.data;

      if (status === 401) {
        cancelTwoFactor();
        errorAlert("Your verification session has expired. Please sign in again.");
        return;
      }

      if (data && typeof data === "object") {
        const payload = data as LoginErrorPayload;
        const suffix =
          typeof payload.attemptsRemaining === "number"
            ? ` (${payload.attemptsRemaining} attempt${payload.attemptsRemaining === 1 ? "" : "s"} remaining)`
            : "";
        errorAlert(`${payload.message || "Verification failed"}${suffix}`);
      } else {
        const message = data || (err as ApiError)?.message || "Verification failed";
        errorAlert(typeof message === "string" ? message : "Verification failed");
      }
      setLoading(false);
    }
  };

  const handleResendTwoFactor = async () => {
    if (twoFactorResendSeconds > 0) return;

    setLoading(true);
    try {
      const res = await axiosInstance.post("/account/login/resend-2fa", {
        twoFactorToken,
      });
      if (res.data?.twoFactorToken) setTwoFactorToken(res.data.twoFactorToken);
      if (res.data?.email) setTwoFactorEmail(res.data.email);
      setTwoFactorCode("");
      setTwoFactorResendSeconds(60);
      successAlert("A new code has been sent");
    } catch (err) {
      const status = (err as ApiError)?.response?.status;
      const data = (err as ApiError)?.response?.data;

      if (status === 401) {
        cancelTwoFactor();
        errorAlert("Your verification session has expired. Please sign in again.");
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        typeof (data as { retryAfterSeconds?: number }).retryAfterSeconds === "number"
      ) {
        setTwoFactorResendSeconds(
          (data as { retryAfterSeconds: number }).retryAfterSeconds,
        );
        errorAlert("Please wait a moment before requesting another code.");
      } else {
        const message = data || (err as ApiError)?.message || "Could not send a new code";
        errorAlert(typeof message === "string" ? message : "Could not send a new code");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      errorAlert("Please enter your email and password");
      return;
    }

    if (isLocked) {
      errorAlert(
        `Too many failed attempts. Try again in ${formatCountdown(remainingSeconds)}.`,
      );
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem(LAST_LOGIN_EMAIL_KEY, normalizedEmail);

    setLoading(true);

    try {
      const res = await axiosInstance.post("/account/login", {
        email,
        password,
      });

      // A 2FA-enabled account stops here: a code was emailed and no session
      // token is issued until it (or a recovery code) is verified.
      if (res.data?.twoFactorRequired) {
        setTwoFactorToken(res.data.twoFactorToken || "");
        setTwoFactorEmail(res.data.email || "");
        setTwoFactorCode("");
        setTwoFactorResendSeconds(60);
        setPassword("");
        setLoading(false);
        return;
      }

      const { account, token } = res.data;
      completeSignIn(account, token);
    } catch (err) {
      const status = (err as ApiError)?.response?.status;
      const data = (err as ApiError)?.response?.data;

      if (
        (status === 401 || status === 429) &&
        data &&
        typeof data === "object"
      ) {
        const payload = data as LoginErrorPayload;
        if (payload.locked && payload.lockedUntil) {
          applyLock(new Date(payload.lockedUntil).getTime());
        }
        if (typeof payload.attemptsRemaining === "number") {
          setAttemptsRemaining(payload.attemptsRemaining);
        }
        const suffix =
          !payload.locked && typeof payload.attemptsRemaining === "number"
            ? ` (${payload.attemptsRemaining} attempt${payload.attemptsRemaining === 1 ? "" : "s"} remaining)`
            : "";
        errorAlert(`${payload.message || "Login failed"}${suffix}`);
      } else {
        const message = data || (err as ApiError)?.message || "Login failed";
        errorAlert(typeof message === "string" ? message : "Login failed");
      }
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
                src={logoUrl}
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
                src={logoUrl}
                alt="Barangay Logo"
                fill
                sizes="64px"
                loading="eager"
                className="object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              {adminMode ? "Super Admin Access" : "Welcome Back"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {adminMode
                ? "Emergency sign-in for barangay super administrators"
                : "Sign in to continue to Barangay Rabon"}
            </p>
            {adminMode && (
              <div className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <ShieldAlert className="size-3.5" />
                Restricted access
              </div>
            )}
          </div>

          {/* Form Card */}
          <div className="glass-card p-8">
            {twoFactorToken ? (
              <form
                onSubmit={handleVerifyTwoFactor}
                className="p-6 sm:p-8 space-y-6"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="twoFactorCode"
                    className="text-sm font-medium text-gray-700"
                  >
                    Two-factor verification
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="twoFactorCode"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      disabled={loading}
                      className="pl-10 h-11 bg-white/60 backdrop-blur-sm border-gray-200/50 focus:border-sky-400 focus:ring-sky-400/20 transition-all rounded-xl"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-medium text-gray-700">
                      {twoFactorEmail}
                    </span>{" "}
                    or one of your recovery codes.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Verify
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleResendTwoFactor}
                    disabled={twoFactorResendSeconds > 0 || loading}
                    className="font-medium text-sky-600 hover:text-sky-700 transition-colors disabled:text-gray-400"
                  >
                    {twoFactorResendSeconds > 0
                      ? `Resend code in ${formatCountdown(twoFactorResendSeconds)}`
                      : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelTwoFactor}
                    className="font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Use a different account
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Email */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
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
                    onBlur={(e) => checkLoginStatus(e.target.value)}
                    className="pl-10 h-11 bg-white/60 backdrop-blur-sm border-gray-200/50 focus:border-sky-400 focus:ring-sky-400/20 transition-all rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
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
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Lockout notice */}
              {isLocked && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <Clock className="size-4 shrink-0" />
                  <span>
                    Too many failed attempts. Try again in{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCountdown(remainingSeconds)}
                    </span>
                    .
                  </span>
                </div>
              )}
              {!isLocked &&
                attemptsRemaining !== null &&
                attemptsRemaining > 0 && (
                  <p className="text-xs text-amber-600">
                    {attemptsRemaining} attempt
                    {attemptsRemaining === 1 ? "" : "s"} remaining before your
                    account is temporarily locked.
                  </p>
                )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || isLocked}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
              >
                {isLocked ? (
                  <>
                    <Clock className="size-4" />
                    Locked
                  </>
                ) : loading ? (
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
            )}
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
                  Enter your account email and choose how to receive your reset
                  code. Email codes are sent to the address on file; SMS codes
                  require confirming the mobile number registered to your
                  account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="forgotEmail"
                    className="text-sm font-medium text-gray-700"
                  >
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
                      onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
                      className="pl-10 h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Send code via
                  </Label>
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
                onClick={handleIdentify}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {forgotStep === "phone" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Smartphone className="size-5 text-sky-600" />
                  Verify your phone
                </DialogTitle>
                <DialogDescription>
                  Confirm the mobile number registered to {forgotEmail}. We
                  showed it as{" "}
                  <span className="font-semibold text-gray-700">
                    {maskedPhone}
                  </span>
                  . Enter your complete registered mobile number.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="phoneFull"
                    className="text-sm font-medium text-gray-700"
                  >
                    Enter your complete registered mobile number.
                  </Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="phoneFull"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="09171234594"
                      value={phoneFull}
                      disabled={forgotBusy}
                      onChange={(e) =>
                        setPhoneFull(
                          e.target.value.replace(/[^\d+]/g, "").slice(0, 13),
                        )
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyPhone()}
                      className="pl-10 h-12 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      aria-label="Complete registered mobile number"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Enter the full number registered to your account — it must
                  match our records exactly.
                </p>
              </div>
              <Button
                onClick={handleVerifyPhone}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Verify &amp; Send Code <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setForgotStep("email")}
                disabled={forgotBusy}
                className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 w-full mt-1 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="size-3" />
                Use a different email
              </button>
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
                <Label
                  htmlFor="resetCode"
                  className="text-sm font-medium text-gray-700"
                >
                  6-Digit Code
                </Label>
                <Input
                  id="resetCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) =>
                    setResetCode(
                      e.target.value.replace(/[^\d]/g, "").slice(0, 6),
                    )
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  className="h-12 text-center text-2xl tracking-[0.5em] border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                />
              </div>
              <Button
                onClick={handleVerifyCode}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Verify Code <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={forgotBusy || resendSeconds > 0}
                className="text-xs text-sky-600 hover:text-sky-700 text-center w-full mt-1 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resendSeconds > 0
                  ? `Resend code in ${resendSeconds}s`
                  : "Didn't get a code? Resend"}
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
                <DialogDescription>
                  Choose a new password for your account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="newPassword"
                    className="text-sm font-medium text-gray-700"
                  >
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
                      {showNewPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {[
                      {
                        label: "At least 8 characters",
                        ok: newPassword.length >= 8,
                      },
                      {
                        label: "Uppercase letter (A-Z)",
                        ok: /[A-Z]/.test(newPassword),
                      },
                      {
                        label: "Lowercase letter (a-z)",
                        ok: /[a-z]/.test(newPassword),
                      },
                      { label: "Number (0-9)", ok: /[0-9]/.test(newPassword) },
                      {
                        label: "Special character (!@#$...)",
                        ok: /[^A-Za-z0-9]/.test(newPassword),
                      },
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
                  <Label
                    htmlFor="confirmNewPassword"
                    className="text-sm font-medium text-gray-700"
                  >
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleResetPassword()
                    }
                    className="h-11 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                  />
                </div>
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={forgotBusy}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl"
              >
                {forgotBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Reset Password"
                )}
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
                  Your password has been changed. You can now sign in with your
                  new password.
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

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
