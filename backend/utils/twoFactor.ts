import bcrypt from "bcrypt";
import crypto from "crypto";

// ── Optional email-OTP two-factor authentication ────────────────────
// Login-time second factor. Mirrors the existing OTP conventions used by
// email verification and password reset: 6-digit code, hashed at rest,
// short TTL, resend cooldown, and a per-account failed-attempt lockout.

export const TWO_FA_CODE_LENGTH = 6;
export const TWO_FA_CODE_TTL_MINUTES = 10;
export const TWO_FA_MAX_ATTEMPTS = 5;
export const TWO_FA_BLOCK_MINUTES = 15;
export const TWO_FA_RESEND_COOLDOWN_SECONDS = 60;
export const TWO_FA_TOKEN_TTL = "10m";

export const TWO_FA_RECOVERY_CODE_COUNT = 8;
// Unambiguous alphabet (no 0/O, 1/I/L) for codes a human may retype.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RECOVERY_CODE_GROUPS = 2;
const RECOVERY_CODE_GROUP_LENGTH = 5;

// Generic failure used everywhere a code/recovery code is checked, so callers
// cannot distinguish "wrong", "expired" and "no code issued".
export const TWO_FA_GENERIC_ERROR = "Invalid or expired code";

export function generateTwoFactorCode(): string {
  let code = "";
  for (let i = 0; i < TWO_FA_CODE_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

export async function hashTwoFactorCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function compareTwoFactorCode(
  code: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/** Normalizes a recovery code for comparison: uppercase, alphanumerics only. */
export function normalizeRecoveryCode(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Generates human-friendly one-time recovery codes, e.g. "ABCDE-FGHJK". */
export function generateRecoveryCodes(
  count: number = TWO_FA_RECOVERY_CODE_COUNT,
): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const groups: string[] = [];
    for (let g = 0; g < RECOVERY_CODE_GROUPS; g++) {
      let group = "";
      for (let c = 0; c < RECOVERY_CODE_GROUP_LENGTH; c++) {
        group += RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)];
      }
      groups.push(group);
    }
    codes.push(groups.join("-"));
  }
  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

export async function compareRecoveryCode(
  code: string,
  hash: string,
): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return false;
  return bcrypt.compare(normalized, hash);
}

/** Masks an email for display, e.g. "juan@gmail.com" -> "j***@gmail.com". */
export function maskEmail(value: unknown): string {
  const email = String(value ?? "").trim();
  const at = email.indexOf("@");
  if (at <= 0) return "";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, local.length - 1))}${domain}`;
}

function codeEmailHtml(
  name: string,
  code: string,
  heading: string,
  intro: string,
): string {
  const firstName = name?.trim().split(" ")[0] || "there";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #0284c7;">${heading}</h2>
      <p>Hi ${firstName},</p>
      <p>${intro}</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f0f9ff; color: #0369a1; text-align: center; padding: 16px; border-radius: 8px; margin: 24px 0;">
        ${code}
      </div>
      <p>This code expires in ${TWO_FA_CODE_TTL_MINUTES} minutes. Do not share it with anyone.</p>
      <p>If you didn't request this, someone may know your password — change it immediately.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Barangay Information Management System</p>
    </div>
  `;
}

export function twoFactorLoginEmailHtml(name: string, code: string): string {
  return codeEmailHtml(
    name,
    code,
    "Your Login Verification Code",
    "Use the code below to finish signing in to your account.",
  );
}

export function twoFactorSetupEmailHtml(name: string, code: string): string {
  return codeEmailHtml(
    name,
    code,
    "Confirm Two-Factor Authentication",
    "Use the code below to confirm enabling two-factor authentication on your account.",
  );
}
