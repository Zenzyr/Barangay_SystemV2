import bcrypt from "bcrypt";
import crypto from "crypto";

export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_TTL_MINUTES = 10;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_OTP_BLOCK_MINUTES = 15;
export const EMAIL_VERIFICATION_TOKEN_TTL = "15m";

export function generateEmailOtp(): string {
  let code = "";
  for (let i = 0; i < EMAIL_OTP_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

export async function hashEmailOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function compareEmailOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Strict email DOMAIN validation.
 *
 * This is NOT ownership proof — it only rejects strings whose domain part is
 * structurally invalid (missing/empty local part, malformed labels, no TLD,
 * bad TLD, consecutive dots, etc.). Ownership is proven exclusively by the
 * OTP the applicant receives at that address and correctly enters. An MX/DNS
 * lookup is deliberately NOT used as a gate: it only proves a domain exists,
 * never that the applicant controls the mailbox, and would wrongly reject
 * sendable-but-MX-less addresses.
 *
 * Returns an error message, or null when the email is structurally valid.
 */
export function emailDomainError(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "Email is required";
  const email = value.trim().toLowerCase();
  if (email.length > 254) return "Email is too long";

  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "Enter a valid email address";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!local) return "Enter a valid email address";
  if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
    return "Enter a valid email address";
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local))
    return "Enter a valid email address";

  const labels = domain.split(".");
  if (labels.length < 2) return "Enter a valid email address";
  for (const label of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      return "Enter a valid email address";
  }
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld)) return "Enter a valid email address";

  return null;
}

export function emailOtpEmailHtml(email: string, code: string): string {
  const safeEmail = String(email || "").replace(/[<>&]/g, "");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #0284c7;">Verify Your Email Address</h2>
      <p>Use the code below to confirm <strong>${safeEmail}</strong> and finish creating your Barangay Rabon account.</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f0f9ff; color: #0369a1; text-align: center; padding: 16px; border-radius: 8px; margin: 24px 0;">
        ${code}
      </div>
      <p>This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes. Do not share it with anyone.</p>
      <p>If you didn't request this code, you can ignore this email.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Barangay Information Management System</p>
    </div>
  `;
}