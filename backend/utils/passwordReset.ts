import bcrypt from "bcrypt";
import crypto from "crypto";
import { normalizePhMobile } from "./validation";

export const RESET_CODE_LENGTH = 6;
export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODE_BLOCK_MINUTES = 15;
export const RESET_CODE_RESEND_COOLDOWN_SECONDS = 60;

// ── Phone-number verification (pre-step for password reset) ──────
// The registered mobile is the source of truth; the applicant only proves
// knowledge of its first two ("09") and last two digits. Five wrong tries
// lock the phone-verification step for 15 minutes.
export const PHONE_VERIFY_MAX_ATTEMPTS = 5;
export const PHONE_VERIFY_BLOCK_MINUTES = 15;
export const PHONE_VERIFY_TOKEN_TTL = "10m";
// Deliberately generic: identical for unknown accounts, wrong digits and
// locked accounts so the endpoint cannot be used to enumerate accounts.
export const PHONE_VERIFY_GENERIC_ERROR =
  "We couldn't verify those details. Please check and try again.";

/**
 * Masks a registered PH mobile into the form the reset UI can safely show,
 * e.g. "09171234567" -> "09*******67". Never returns the full number.
 * Returns null when the value is not a valid PH mobile number.
 */
export function maskRegisteredPhone(contact: unknown): string | null {
  const digits = normalizePhMobile(contact);
  if (!digits) return null;
  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

export function generateResetCode(): string {
  let code = "";
  for (let i = 0; i < RESET_CODE_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

export async function hashResetCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function compareResetCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function resetCodeSmsMessage(code: string): string {
  return `Your barangay account password reset code is ${code}. It expires in ${RESET_CODE_TTL_MINUTES} minutes. Do not share this code with anyone.`;
}

export function resetCodeEmailHtml(name: string, code: string): string {
  const firstName = name?.trim().split(" ")[0] || "there";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #0284c7;">Password Reset Code</h2>
      <p>Hi ${firstName},</p>
      <p>Use the code below to reset your password. This code expires in ${RESET_CODE_TTL_MINUTES} minutes.</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f0f9ff; color: #0369a1; text-align: center; padding: 16px; border-radius: 8px; margin: 24px 0;">
        ${code}
      </div>
      <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Barangay Information Management System</p>
    </div>
  `;
}
