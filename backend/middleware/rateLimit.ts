import { rateLimit } from "express-rate-limit";

// Per-IP rate limits for public SMS/OTP endpoints. These guard against
// credential/reset-code brute force and SMS/email cost abuse (each
// forgot-password SMS costs the barangay money, and every OTP send hits the
// mail/SMS provider). The limits are generous enough for a real applicant who
// requests a code and resends once or twice, but tight enough to stop
// automation.
const WINDOW_MS = 15 * 60 * 1000;

const tooManyRequests = () =>
  ({
    message: "Too many requests. Please try again later.",
  }) as const;

// Send/resend of email-ownership OTP: shared so send + resend count together.
export const otpSendLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Forgot-password triggers a paid SMS and has no per-account cooldown, so it
// is kept tighter than the OTP send path.
export const forgotPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Phone-number challenge + verification for password reset. The per-account
// lockout (5 tries / 15 min) is the primary control; this only bounds how
// often a single IP can hit the two lookup/verify endpoints.
export const forgotPhoneLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// OTP verification: the email-OTP flow already caps at 5 wrong attempts per
// email, so this only bounds distributed per-IP guessing.
export const otpVerifyLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Reset-code verification has no per-account attempt cap yet, so keep the
// per-IP budget small: with a 10-minute code TTL, 10 guesses per IP per
// 15 minutes makes brute forcing a 6-digit code impractical.
export const resetCodeVerifyLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Issuing a new password requires the resetToken + a fresh password; bound it
// to reduce abuse of password updates from a single IP.
export const resetPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Two-factor code send/resend (login second step + setup). Each send costs an
// email, so bound how often a single IP can trigger one.
export const twoFactorSendLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Two-factor code verification. The per-account lockout (5 tries / 15 min) is
// the primary control; this only bounds distributed per-IP guessing.
export const twoFactorVerifyLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});

// Public/guest AI chat: every reply triggers a paid Gemini call, so bound
// per-IP usage to keep the landing-page assistant from being abused.
export const publicAiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooManyRequests(),
});