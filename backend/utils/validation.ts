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

export const isGmailAddress = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@gmail\.com$/i.test(value.trim());
};

export const householdNumberError = (
  value: unknown,
  previousValue?: unknown,
): string | null => {
  if (!isNonEmptyString(value)) return "Household number is required";
  const trimmed = value.trim();
  if (typeof previousValue === "string" && previousValue.trim() === trimmed) {
    return null;
  }
  if (trimmed.toUpperCase() === "N/A") return null;
  if (!/^HH-(?!0+$)\d{3,4}$/i.test(trimmed)) {
    return "Household number must be HH-001 to HH-999 or HH-0001 to HH-9999";
  }
  return null;
};

// Strict census cellphone rule: exactly 11 digits starting with 09. An empty or
// "N/A" value is allowed (unknown). When a previous value is supplied (edit),
// an unchanged legacy value is accepted so untouched data is preserved.
export const CELLPHONE_ERROR =
  "Cellphone number must be exactly 11 digits and start with 09.";

export const cellphoneError = (
  value: unknown,
  previousValue?: unknown,
): string | null => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.toUpperCase() === "N/A") return null;
  if (typeof previousValue === "string" && previousValue.trim() === raw) return null;
  if (!/^09\d{9}$/.test(raw)) return CELLPHONE_ERROR;
  return null;
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

/**
 * Builds a regex that matches any stored PH mobile number equivalent to
 * `value`, tolerating the +63 / 63 / 0 prefixes and separators (spaces,
 * dashes, dots, parentheses) that legacy/raw saved contacts may carry.
 * Returns null when `value` is not a valid PH mobile number.
 */
export const phMobileMatchRegex = (value: unknown): RegExp | null => {
  const normalized = normalizePhMobile(value); // 09XXXXXXXXX
  if (!normalized) return null;
  const subscriber = normalized.slice(1); // 9XXXXXXXXX (10 digits)
  const digitPattern = subscriber.split("").join("[^\\d]*");
  return new RegExp(`^(?:\\+?63[^\\d]*|0[^\\d]*)?${digitPattern}$`);
};

/** Masks a PH mobile number keeping only the last two digits (0917... -> *********17). */
export const maskPhMobile = (value: unknown): string => {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (digits.length < 2) return digits || "*";
  return `${"*".repeat(digits.length - 2)}${digits.slice(-2)}`;
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

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes a single optional YYYY-MM-DD bound.
 * Returns:
 *  - undefined when the value is absent/empty (meaning "no bound")
 *  - null when the value is present but malformed
 *  - the trimmed value when valid
 */
const asIsoDateBound = (value: unknown): string | undefined | null => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!ISO_DATE_ONLY.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (isNaN(parsed.getTime())) return null;
  return trimmed;
};

/**
 * Validates an optional { from, to } date range (YYYY-MM-DD). Absent bounds are
 * allowed ("all time"). Returns a normalized range or a human-readable error;
 * consumers should 400 on error rather than silently ignoring bad input.
 */
export const parseDateRange = (source: {
  from?: unknown;
  to?: unknown;
}): { from?: string; to?: string; error?: string } => {
  const from = asIsoDateBound(source?.from);
  const to = asIsoDateBound(source?.to);
  if (from === null) return { error: "Invalid 'from' date. Use YYYY-MM-DD." };
  if (to === null) return { error: "Invalid 'to' date. Use YYYY-MM-DD." };
  if (from && to && from > to) return { error: "'from' must be on or before 'to'." };
  return { from, to };
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

// ── Resident skills ──────────────────────────────────────────────

export const MIN_SKILL_NAME_LENGTH = 2;
export const MAX_SERVICE_TYPE_LENGTH = 60;
export const MIN_SERVICE_TYPE_LENGTH = 2;
export const MAX_SERVICE_TYPES = 10;

const SKILL_NAME_REGEX = /^[a-zA-ZñÑ\s.'&-]+$/;
const SERVICE_TYPE_REGEX = /^[a-zA-ZñÑ0-9\s.'&/()-]+$/;

export const skillNameError = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim())
    return "Please enter a valid skill";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < MIN_SKILL_NAME_LENGTH)
    return `Please enter a valid skill (at least ${MIN_SKILL_NAME_LENGTH} characters)`;
  if (trimmed.length > MAX_SKILL_NAME_LENGTH)
    return `Please enter a valid skill (at most ${MAX_SKILL_NAME_LENGTH} characters)`;
  if (!SKILL_NAME_REGEX.test(trimmed))
    return "Please enter a valid skill (letters, spaces, and - . ' & only)";
  return null;
};

/** Trims, collapses whitespace, drops empties, and removes case-insensitive duplicates. */
export const normalizeServiceTypes = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const trimmed = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

/** Validates a single user-entered ("Other, specify") service type. */
export const customServiceTypeError = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim())
    return "Please enter a valid service type";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (
    trimmed.length < MIN_SERVICE_TYPE_LENGTH ||
    trimmed.length > MAX_SERVICE_TYPE_LENGTH
  )
    return `Please enter a valid service type (between ${MIN_SERVICE_TYPE_LENGTH} and ${MAX_SERVICE_TYPE_LENGTH} characters)`;
  if (!SERVICE_TYPE_REGEX.test(trimmed))
    return "Please enter a valid service type (letters, numbers, spaces, and - . ' & / ( ) only)";
  return null;
};

// ── Password strength (mirrors frontend rules) ───────────────────

export const passwordStrengthError = (password: string): string | null => {
  if (typeof password !== "string" || !password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Z]/.test(password))
    return "Password must include an uppercase letter (A-Z)";
  if (!/[a-z]/.test(password))
    return "Password must include a lowercase letter (a-z)";
  if (!/[0-9]/.test(password)) return "Password must include a number (0-9)";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must include a special character";
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
  if (error.code === 11000)
    return "A record with the same value already exists";
  if (error.name === "CastError") return "Invalid identifier format";
  return "Invalid data";
};
