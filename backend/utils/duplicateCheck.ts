import crypto from "crypto";
import AccountModel from "../model/account.model";
import ResidentCensusModel from "../model/residentCensus.model";

// =====================================================================
// ONE PERSON = ONE ACCOUNT — duplicate registration prevention
// =====================================================================
//
// Identity matching is done on the BACKEND using the fields that already
// exist in the schemas (both collections store a full name string plus a
// date/sex/contact, just under different field names):
//
//   accounts   : name, dateOfBirth, gender, contact
//   census     : name, birthday,     sex,   cellphone
//
// Email is never used as an identity key for person matching. A confident
// match against an existing ACCOUNT blocks registration (generic message,
// no private details). Uncertain matches are FLAGGED for review but never
// block, and never merge records.

export type RecordKind = "account" | "census";

export interface IdentityRef {
  kind: RecordKind;
  id: string;
  name: string;
  dob?: string;
  gender?: string;
  contact?: string;
}

export type MatchLevel = "confident" | "likely" | "clean";

export interface PersonAssessment {
  status: "clean" | "flagged" | "blocked";
  reason?: string;
  records?: IdentityRef[];
}

export const DUPLICATE_PERSON_MSG =
  "This person is already registered in the system. Please log in using your existing account or use account recovery.";

export const EMAIL_IN_USE_MSG =
  "An account already exists for this email. Please sign in or use account recovery.";

// ── Name normalization (order-aware, so "Dela Cruz Juan Michael" and
//    "Juan Michael Dela Cruz" compare equal) ───────────────────────────
const SUFFIX_TOKENS = new Set([
  "jr", "sr", "i", "ii", "iii", "iv", "v", "vi",
  "1st", "2nd", "3rd", "4th", "5th",
]);

function nameTokens(raw: unknown): string[] {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-zñ0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Sorted token set — order-insensitive but ignores nothing else. */
function nameKey(raw: unknown): string {
  return nameTokens(raw).sort().join(" ");
}

function nameParts(raw: unknown): { first: string; last: string } {
  const s = String(raw || "").trim();
  // "Surname,Given Names" (census) vs "Given Names Surname" (accounts).
  const commaSplit = s.split(",").map((p) => p.trim()).filter(Boolean);
  const withoutY = (toks: string[]) => toks.filter((t) => t !== "y");
  const toks = withoutY(nameTokens(s));

  if (commaSplit.length >= 2) {
    const sur = withoutY(nameTokens(commaSplit[0])).pop() || "";
    const given = withoutY(nameTokens(commaSplit[1])).filter(
      (t) => !SUFFIX_TOKENS.has(t)
    );
    return { last: sur, first: given[0] || "" };
  }

  let last = "";
  for (let i = toks.length - 1; i >= 0; i--) {
    if (!SUFFIX_TOKENS.has(toks[i])) { last = toks[i]; break; }
  }
  return { first: toks[0] || "", last };
}

export function firstName(raw: unknown): string {
  return nameParts(raw).first;
}

export function surname(raw: unknown): string {
  return nameParts(raw).last;
}

// ── Date normalization: many formats to a YYYYMMDD key ───────────────
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

export function normalizeDate(raw: unknown): string | null {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (y: number, m: number, d: number): string | null => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    if (y < 1900 || y > 2100) return null;
    return `${y}${pad(m)}${pad(d)}`;
  };

  // YYYY-MM-DD / YYYY/M/D
  let m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(s);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  // January 10, 2000 / jan 10 2000
  m = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m && MONTHS[m[1]]) return ymd(Number(m[3]), MONTHS[m[1]], Number(m[2]));

  // 10 January 2000 / 10-jan-2000
  m = /^(\d{1,2})\s*[-\/\s.]\s*([a-z]+)\s*[-\/\s,.]?\s*(\d{4})$/.exec(s);
  if (m && MONTHS[m[2]]) return ymd(Number(m[3]), MONTHS[m[2]], Number(m[1]));

  // mm/dd/yyyy or dd/mm/yyyy (numeric, ambiguous) — use the format that
  // produces a valid calendar date; only accept when one interpretation works.
  m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += y < 50 ? 2000 : 1900;
    const a = ymd(y, Number(m[1]), Number(m[2]));
    const b = ymd(y, Number(m[2]), Number(m[1]));
    if (a && !b) return a;
    if (b && !a) return b;
    if (a && b) return a; // symmetric (e.g. 11/11/2000) — value identical either way
  }

  return null;
}

/** First letter of the gender, so "Male"/"Male"/"m" all normalize. */
function genderNorm(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s.startsWith("m")) return "m";
  if (s.startsWith("f")) return "f";
  if (s.startsWith("o")) return "o";
  return "";
}

/** Canonical PH mobile key: 09XXXXXXXXX (11 digits) or 639… → 0… */
function contactNorm(raw: unknown): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("63")) d = "0" + d.slice(2);
  return d.length === 11 && d.startsWith("09") ? d : "";
}

interface RawIdentity {
  name: unknown;
  dob?: unknown;
  gender?: unknown;
  contact?: unknown;
}

// ── Person-to-person match ───────────────────────────────────────────
// Never treats a name match alone as a duplicate. Date of birth (or a
// phone number) must agree before we call two records the same person.
export function matchPerson(c: RawIdentity, e: RawIdentity): MatchLevel {
  const fullEq =
    !!nameKey(c.name) && nameKey(c.name) === nameKey(e.name);
  const firstEq = !!firstName(c.name) && firstName(c.name) === firstName(e.name);
  const lastEq = !!surname(c.name) && surname(c.name) === surname(e.name);

  const dobC = normalizeDate(c.dob);
  const dobE = normalizeDate(e.dob);
  const dobEq = !!dobC && !!dobE && dobC === dobE;

  const gC = genderNorm(c.gender);
  const gE = genderNorm(e.gender);
  const genderConflict = !!gC && !!gE && gC !== gE;

  const contactC = contactNorm(c.contact);
  const contactE = contactNorm(e.contact);
  const contactEq = !!contactC && !!contactE && contactC === contactE;

  // Same name but a KNOWN different DOB → different people (e.g. two
  // "Juan Dela Cruz" born on different dates). Never block, never flag.
  if (fullEq || (firstEq && lastEq)) {
    if (dobEq) return genderConflict ? "likely" : "confident";
    if (dobC && dobE) return "clean";
    return "likely"; // name matches but DOB missing somewhere — uncertain
  }

  if (contactEq && dobEq) return genderConflict ? "likely" : "confident";
  if (lastEq && dobEq) {
    // Same surname + birthday usually means the same household, not the
    // same person (e.g. a couple that happens to share a birthday).
    // Different given name + different sex → clearly different people.
    if (!firstEq && genderConflict) return "clean";
    return "likely";
  }
  if (firstEq && dobEq) return "likely";

  return "clean";
}

// Sorted unique identity keys for the deterministic race-safe hash.
export function computeIdentityHash(name: unknown, dob: unknown): string {
  const ymd = normalizeDate(dob);
  const first = firstName(name);
  const last = surname(name);
  if (!ymd || !first || !last) return "";
  return crypto
    .createHash("sha256")
    .update(`${ymd}|${first}|${last}`)
    .digest("hex");
}

/**
 * Assesses a registration candidate against existing accounts and the
 * resident census.
 *
 *   blocked  → an ACCOUNT for this person already exists (stop, generic msg)
 *   flagged  → uncertain / census-only match (allow creation, mark for review)
 *   clean    → no match
 */
export async function assessPersonRegistration(candidate: {
  name?: unknown;
  dateOfBirth?: unknown;
  gender?: unknown;
  contact?: unknown;
}): Promise<PersonAssessment> {
  const c: RawIdentity = {
    name: candidate.name,
    dob: candidate.dateOfBirth,
    gender: candidate.gender,
    contact: candidate.contact,
  };

  const [accounts, census] = await Promise.all([
    AccountModel.find({})
      .select("_id name dateOfBirth gender contact")
      .lean(),
    ResidentCensusModel.find({})
      .select("_id name birthday sex cellphone")
      .lean(),
  ]);

  const toRef = (kind: RecordKind, r: any): IdentityRef => ({
    kind,
    id: String(r._id),
    name: String(r.name || ""),
    dob: kind === "account" ? r.dateOfBirth : r.birthday,
    gender: kind === "account" ? r.gender : r.sex,
    contact: kind === "account" ? r.contact : r.cellphone,
  });

  const flagged: { level: MatchLevel; ref: IdentityRef }[] = [];
  const censusMatches: IdentityRef[] = [];

  for (const a of accounts) {
    const ref = toRef("account", a);
    const level = matchPerson(c, {
      name: a.name,
      dob: a.dateOfBirth,
      gender: a.gender,
      contact: a.contact,
    });
    if (level === "confident") {
      // A person with a matching account is re-registering → stop.
      return {
        status: "blocked",
        reason: "A matching account already exists for this person",
        records: [ref],
      };
    }
    if (level === "likely") flagged.push({ level, ref });
  }

  for (const r of census) {
    const ref = toRef("census", r);
    const level = matchPerson(c, {
      name: r.name,
      dob: r.birthday,
      gender: r.sex,
      contact: r.cellphone,
    });
    if (level === "confident") censusMatches.push(ref);
    else if (level === "likely") flagged.push({ level, ref });
  }

  if (censusMatches.length) {
    // Already a barangay resident per the census. This is very likely the
    // resident's FIRST account, so it is allowed — but flagged so the
    // verifying clerk confirms identity before approving.
    return {
      status: "flagged",
      reason: "Person already exists in the resident census",
      records: censusMatches.slice(0, 10),
    };
  }

  if (flagged.length) {
    return {
      status: "flagged",
      reason: "Possible duplicate — details partially match existing records",
      records: flagged.slice(0, 10).map((f) => f.ref),
    };
  }

  return { status: "clean" };
}

// ── Duplicate REPORT (read-only, for administrator review) ───────────
export interface DuplicateReportEntry {
  a: IdentityRef;
  b: IdentityRef;
  level: MatchLevel;
  reason: string;
}

const REASON_BY_LEVEL: Record<MatchLevel, string> = {
  confident: "Same name and date of birth — likely the same person",
  likely: "Partially matching identity details — possible same person",
  clean: "No match",
};

export async function buildDuplicateReport(): Promise<DuplicateReportEntry[]> {
  const [accounts, census] = await Promise.all([
    AccountModel.find({})
      .select("_id name dateOfBirth gender contact")
      .lean(),
    ResidentCensusModel.find({})
      .select("_id name birthday sex cellphone")
      .lean(),
  ]);

  const acctRefs = accounts.map((a) => toIdentityRef("account", a));
  const censusRefs = census.map((r) => toIdentityRef("census", r));

  const entries: DuplicateReportEntry[] = [];
  const add = (a: IdentityRef, b: IdentityRef) => {
    const level = matchPerson(
      { name: a.name, dob: a.dob, gender: a.gender, contact: a.contact },
      { name: b.name, dob: b.dob, gender: b.gender, contact: b.contact }
    );
    if (level !== "clean") {
      entries.push({ a, b, level, reason: REASON_BY_LEVEL[level] });
    }
  };

  for (let i = 0; i < acctRefs.length; i++) {
    for (let j = i + 1; j < acctRefs.length; j++) add(acctRefs[i], acctRefs[j]);
  }
  for (const a of acctRefs) {
    for (const bc of censusRefs) add(a, bc);
  }
  for (let i = 0; i < censusRefs.length; i++) {
    for (let j = i + 1; j < censusRefs.length; j++) add(censusRefs[i], censusRefs[j]);
  }

  return entries.slice(0, 500);
}

function toIdentityRef(kind: RecordKind, r: any): IdentityRef {
  return {
    kind,
    id: String(r._id),
    name: String(r.name || ""),
    dob: kind === "account" ? r.dateOfBirth : r.birthday,
    gender: kind === "account" ? r.gender : r.sex,
    contact: kind === "account" ? r.contact : r.cellphone,
  };
}