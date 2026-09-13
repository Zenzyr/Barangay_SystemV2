import mongoose from "mongoose";

// ── Generic helpers ──────────────────────────────────────────────

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isEmail = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(value.trim());
};

// Philippine mobile number: 09XXXXXXXXX (11 digits) or 639XXXXXXXXX
export const isPhilippineMobile = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  const digits = value.replace(/[^\d]/g, "");
  return (
    (digits.length === 11 && /^09/.test(digits)) ||
    (digits.length === 12 && /^639/.test(digits)) ||
    (digits.length === 10 && /^9/.test(digits))
  );
};

/** Normalizes a PH mobile number to the 09XXXXXXXXX form (e.g. 63917 -> 0917). */
export const normalizePhMobile = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 11 && /^09/.test(digits)) return digits;
  if (digits.length === 12 && /^639/.test(digits)) return `0${digits.slice(2)}`;
  if (digits.length === 10 && /^9/.test(digits)) return `0${digits}`;
  return null;
};

// Names: letters, ñ, spaces, periods, hyphens, apostrophes
export const isName = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  return /^[a-zA-ZñÑ.'\-\s]+$/.test(value.trim());
};

export const isObjectId = (value: unknown): value is string => {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
};

export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === "boolean";
};

export const isDateString = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
};

export const isIn = <T extends readonly string[]>(allowed: T) => {
  return (value: unknown): value is T[number] =>
    typeof value === "string" && (allowed as readonly string[]).includes(value);
};

export const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
};

export const isValidUrl = (value: unknown): boolean => {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

// ── Length size limits ───────────────────────────────────────────

export const MAX_NAME_LENGTH = 100;
export const MAX_ADDRESS_LENGTH = 255;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_SHORT_TEXT_LENGTH = 200;
export const MAX_SKILL_NAME_LENGTH = 80;

export const withinLength = (value: unknown, max: number): boolean =>
  typeof value === "string" && value.trim().length <= max;

// ── Password strength (mirrors frontend rules) ───────────────────

export const passwordStrengthError = (password: string): string | null => {
  if (typeof password !== "string" || !password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter (A-Z)";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter (a-z)";
  if (!/[0-9]/.test(password)) return "Password must include a number (0-9)";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character";
  return null;
};

// ── Mongoose validation error extraction ─────────────────────────

export const mongooseValidationMessage = (error: any): string => {
  if (!error || typeof error !== "object") return "Invalid data";
  if (error.name === "ValidationError" && error.errors) {
    const firstKey = Object.keys(error.errors)[0];
    if (firstKey && error.errors[firstKey]?.message) {
      return error.errors[firstKey].message;
    }
  }
  if (error.code === 11000) return "A record with the same value already exists";
  if (error.name === "CastError") return "Invalid identifier format";
  return "Invalid data";
};
