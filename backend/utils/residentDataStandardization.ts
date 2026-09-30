import { normalizePhMobile } from "./validation";
import { calculateAge } from "./age";

/**
 * Shared canonicalization for the Resident Census.
 *
 * Used by:
 *  - the one-time standardization migration (scripts/standardizeResidentCensus.ts)
 *  - manual add/update (controller)
 *  - CSV/JSON bulk import (service buskImport)
 *  - the account ↔ census sync (upsertFromAccount / syncLinkedAccount)
 *
 * Principle: unknown / missing data stays "N/A". We only rewrite values that
 * are provably equivalent to an existing representation — never guesses, and
 * never infer sex or any identity value from a name.
 */

// Synonyms for "not applicable / unknown" (mirrors residentCensus.service).
const NVA = ["", "n/a", "na", "none", "null", "-", "undeclared", "not applicable"];

export function isUnknown(value: unknown): boolean {
  const raw = String(value == null ? "" : value).trim();
  return !raw || NVA.includes(raw.toLowerCase());
}

function collapse(value: unknown): string {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
}

// ── Sex ─────────────────────────────────────────────────────────────
// Canonical census values are "M" and "F". Anything that is not clearly an
// M/F (or NVA) is preserved as-is — e.g. signup's "Other" — never guessed.
export function normalizeCensusSex(value: unknown): string {
  const raw = collapse(value);
  if (isUnknown(raw)) return "N/A";
  const up = raw.toUpperCase();
  if (up === "M" || up === "MALE") return "M";
  if (up === "F" || up === "FEMALE") return "F";
  return raw;
}

// Maps a canonical census sex back to the Accounts domain spelling
// (signup enum: Male / Female / Other) so syncing never writes "M" into an
// account.gender. Non-M/F values pass through unchanged.
export function censusSexToAccountGender(sex: unknown): string {
  const raw = collapse(sex);
  if (raw === "M") return "Male";
  if (raw === "F") return "Female";
  if (isUnknown(raw)) return "";
  return raw;
}

// ── Education ───────────────────────────────────────────────────────
// The live collection already uses a small canonical set (all UPPERCASE).
// We only trim/collapse whitespace and fold N/A-synonyms; no word rewriting.
export function normalizeEducation(value: unknown): string {
  return isUnknown(value) ? "N/A" : collapse(value);
}

// ── Occupation ──────────────────────────────────────────────────────
// Current canonical (UPPERCASE) values observed in the collection, i.e. the
// "already good" values the cleanup converges towards.
const CANONICAL_OCCUPATIONS = new Set([
  "N/A", "FISHERMAN", "FISH VENDOR", "HOUSEWIFE", "HOUSEKEEPER",
  "BUSINESS MAN", "BUSINESS WOMAN", "CALL CENTER", "CARPENTER", "CREW",
  "EVENT ORGANIZER", "FACTORY WORKER", "FARMER", "GOV. EMPLOYEE",
  "HAIR AND MAKE UP ARTIST", "LDP DRESSER", "LNP", "MIDWIFE", "OEW",
  "OFFICE", "OFFICE CLERK", "OFFICE WORK", "OFW", "PAINTER", "PHARMACIST",
  "SALES LADY", "STORE OWNER", "WAITRESS",
]);

// Clearly-equivalent variant → canonical. Applied on the whitespace-collapsed,
// upper-cased token. Anything not listed here is preserved unchanged.
const OCCUPATION_MAP: Record<string, string> = {
  "FISHER MAN": "FISHERMAN",
  "HOUSE WIFE": "HOUSEWIFE",
  "MID WIFE": "MIDWIFE",
  "HOUSE KEEPER": "HOUSEKEEPER",
  "GOV.EMPLOYE": "GOV. EMPLOYEE",
  "OFFICE CLARK": "OFFICE CLERK",
  "WAITRES": "WAITRESS",
};

export function normalizeOccupation(value: unknown): string {
  const raw = collapse(value);
  if (isUnknown(raw)) return "N/A";
  const key = raw.toUpperCase();
  if (OCCUPATION_MAP[key]) return OCCUPATION_MAP[key];
  // Case-only variant of a value that already exists in canonical form.
  if (CANONICAL_OCCUPATIONS.has(key) && key !== raw) return key;
  return raw; // preserve everything else (e.g. legacy "Office", "OEW", ...)
}

// ── Pensioner ───────────────────────────────────────────────────────
// Free-text (analytics counts it as "filled"). We only collapse whitespace
// and fold N/A-synonyms; existing typed values ("SSS PENSIONER",
// "SENIOR CITIZEN PENSIONER") keep their meaning and are not rewritten.
export function normalizePensioner(value: unknown): string {
  return isUnknown(value) ? "N/A" : collapse(value);
}

// ── Yes/No flags (is4Ps, soloParent, isSenior, hpnMaintenance, isPWD) ──
export function normalizeYesNoFlag(value: unknown): string {
  const raw = collapse(value);
  if (isUnknown(raw)) return "N/A";
  const up = raw.toUpperCase();
  if (up === "YES") return "YES";
  if (up === "NO") return "NO";
  return raw; // preserve anything else
}

// ── Cellphone ───────────────────────────────────────────────────────
// Reuses the app's existing Philippine-mobile normalizer. Invalid/ambiguous
// values are preserved (never fabricated).
export function normalizeCellphone(value: unknown): string {
  if (isUnknown(value)) return "N/A";
  const normalized = normalizePhMobile(value);
  return normalized ?? collapse(value);
}

// ── Age / birthday consistency ──────────────────────────────────────
// A birthday with the valid YYYY-MM-DD shape is authoritative. Age is only
// corrected when it provably disagrees, or normalized to a number when it
// already matches the computed age (the collection's numeric convention).
// Deliberate infant labels like "11 MONTHS" are preserved untouched.
export function normalizeAge(age: unknown, birthday: unknown): unknown {
  const bday = collapse(birthday);
  const isIsoDate =
    /^\d{4}-\d{2}-\d{2}$/.test(bday) &&
    !isNaN(new Date(`${bday}T00:00:00Z`).getTime());
  if (!isIsoDate) return age; // no valid birthday → nothing to reconcile

  const computed = Number(calculateAge(bday));

  if (typeof age === "number") {
    if (!isNaN(age) && Math.abs(age - computed) > 1) return computed;
    return age;
  }

  if (typeof age === "string") {
    const t = age.trim();
    if (!t || t.toUpperCase().includes("MONTH")) return age; // intentional infant label / unknown
    if (!/^\d+$/.test(t)) return age; // opaque string → preserve
    const asNumber = Number(t);
    if (asNumber !== computed) return computed;
    return asNumber; // matches computed age → store as the numeric convention
  }

  return age;
}

/** True when the record has no usable identity name at all. */
export function hasNoName(value: unknown): boolean {
  return isUnknown(value);
}