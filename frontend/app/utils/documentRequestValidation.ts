export const TITLE_NO_PREFIX = "RT-";

export const PROFILE_FIELD_KEYS = [
  "fullName",
  "contact",
  "address",
  "dateOfBirth",
  "civilStatus",
  "age",
  "purok",
];

export const DOCUMENT_REQUIRED_FIELDS: Record<string, string[]> = {
  certificationOfCohabitant: ["spouseName"],
};

export const FIELD_MAX_LENGTHS: Record<string, number> = {
  fullName: 100,
  spouseName: 100,
  assistanceTo: 100,
  contact: 11,
  address: 255,
  purok: 50,
  businessName: 120,
  businessAddress: 255,
  businessType: 60,
  businessNature: 120,
  workplace: 120,
  expenseType: 100,
  treeType: 100,
  purpose: 200,
  titleNo: TITLE_NO_PREFIX.length + 20,
  taxDeclarationNo: 25,
};

const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated"];
const WORK_STATUSES = ["working", "non working", "self employed", "unemployed"];

const NAME_PATTERN = /^[a-zA-ZñÑ.'\-\s]+$/;
const ADDRESS_PATTERN = /^[a-zA-Z0-9ñÑ.,#'()/\-\s]+$/;
const BUSINESS_NAME_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/#!+\-\s]+$/;
const DESCRIPTIVE_PATTERN = /^[a-zA-ZñÑ.,&'()/\-\s]+$/;
const DESCRIPTIVE_WITH_DIGITS_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/\-\s]+$/;
const PURPOSE_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/#:;\-\s]+$/;
const PUROK_PATTERN = /^[a-zA-Z0-9ñÑ.\-\s]+$/;
const DIGIT_GROUPS_PATTERN = /^\d+(-\d+)*$/;
const MOBILE_PATTERN = /^09\d{9}$/;

type FieldValue = string | number | null | undefined;

const letterCount = (value: string) => (value.match(/[a-zA-ZñÑ]/g) || []).length;

const textError = (
  label: string,
  value: string,
  {
    min,
    max,
    pattern,
    allowed,
    minLetters = 1,
  }: { min: number; max: number; pattern: RegExp; allowed: string; minLetters?: number },
): string | null => {
  if (value.length < min) return `${label} must be at least ${min} characters.`;
  if (value.length > max) return `${label} must be at most ${max} characters.`;
  if (!pattern.test(value)) return `${label} can only contain ${allowed}.`;
  if (letterCount(value) < minLetters) {
    return minLetters > 1
      ? `${label} must contain at least ${minLetters} letters.`
      : `${label} must contain letters, not numbers only.`;
  }
  return null;
};

const numberError = (
  label: string,
  raw: string,
  { min, max, integer = false }: { min: number; max: number; integer?: boolean },
): string | null => {
  if (!/^\d+(\.\d+)?$/.test(raw)) return `${label} must be a valid number.`;
  if (integer && !/^\d+$/.test(raw)) return `${label} must be a whole number.`;
  if (!integer && !/^\d+(\.\d{1,2})?$/.test(raw)) return `${label} can have at most 2 decimal places.`;
  const n = Number(raw);
  if (n < min) return `${label} must be at least ${min.toLocaleString("en-US")}.`;
  if (n > max) return `${label} must not exceed ${max.toLocaleString("en-US")}.`;
  return null;
};

const pastDateError = (label: string, raw: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw) || isNaN(new Date(raw).getTime())) {
    return `${label} must be a valid date.`;
  }
  const date = new Date(raw);
  if (date.getFullYear() < 1900) return `${label} must be after the year 1900.`;
  if (date.getTime() > Date.now()) return `${label} cannot be in the future.`;
  return null;
};

export const stripTitlePrefix = (value: string): string => {
  let rest = value.trim().toUpperCase().replace(/\s+/g, "");
  while (/^RT-?/.test(rest)) rest = rest.replace(/^RT-?/, "");
  return rest;
};

export const normalizeTitleNo = (value: FieldValue): string => {
  const rest = stripTitlePrefix(String(value ?? ""));
  return rest ? `${TITLE_NO_PREFIX}${rest}` : "";
};

export function documentFieldError(key: string, value: FieldValue): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  switch (key) {
    case "fullName":
      return textError("Full name", raw, {
        min: 3, max: 100, pattern: NAME_PATTERN, allowed: "letters, spaces, periods, hyphens and apostrophes", minLetters: 2,
      });
    case "spouseName":
      return textError("Spouse name", raw, {
        min: 3, max: 100, pattern: NAME_PATTERN, allowed: "letters, spaces, periods, hyphens and apostrophes", minLetters: 2,
      });
    case "assistanceTo":
      return textError("Assistance for", raw, {
        min: 3, max: 100, pattern: DESCRIPTIVE_PATTERN, allowed: "letters, spaces and basic punctuation", minLetters: 2,
      });
    case "address":
      return textError("Address", raw, {
        min: 5, max: 255, pattern: ADDRESS_PATTERN, allowed: "letters, numbers, spaces and . , # - ' / ( )",
      });
    case "purok":
      return textError("Purok", raw, {
        min: 1, max: 50, pattern: PUROK_PATTERN, allowed: "letters, numbers, spaces, periods and hyphens", minLetters: 0,
      });
    case "contact":
      return MOBILE_PATTERN.test(raw) ? null : "Contact number must be exactly 11 digits and start with 09.";
    case "civilStatus":
      return CIVIL_STATUSES.includes(raw) ? null : "Please select a valid civil status.";
    case "workStatus":
      return WORK_STATUSES.includes(raw) ? null : "Please select a valid employment status.";
    case "dateOfBirth":
      return pastDateError("Date of birth", raw);
    case "spouseDateOfBirth":
      return pastDateError("Partner date of birth", raw);
    case "age":
      return numberError("Age", raw, { min: 1, max: 120, integer: true });
    case "businessName":
      return textError("Business name", raw, {
        min: 3, max: 120, pattern: BUSINESS_NAME_PATTERN, allowed: "letters, numbers, spaces and . , & ' ( ) / # ! + -", minLetters: 3,
      });
    case "businessAddress":
      return textError("Business address", raw, {
        min: 5, max: 255, pattern: ADDRESS_PATTERN, allowed: "letters, numbers, spaces and . , # - ' / ( )", minLetters: 3,
      });
    case "businessType":
      return textError("Business type", raw, {
        min: 3, max: 60, pattern: DESCRIPTIVE_PATTERN, allowed: "letters, spaces and . , & ' ( ) / -", minLetters: 3,
      });
    case "businessNature":
      return textError("Nature of business", raw, {
        min: 3, max: 120, pattern: DESCRIPTIVE_WITH_DIGITS_PATTERN, allowed: "letters, numbers, spaces and . , & ' ( ) / -", minLetters: 3,
      });
    case "workplace":
      return textError("Workplace / company", raw, {
        min: 3, max: 120, pattern: BUSINESS_NAME_PATTERN, allowed: "letters, numbers, spaces and . , & ' ( ) / # ! + -", minLetters: 3,
      });
    case "expenseType":
      return textError("Type of unforeseen expense", raw, {
        min: 3, max: 100, pattern: DESCRIPTIVE_PATTERN, allowed: "letters, spaces and . , & ' ( ) / -", minLetters: 3,
      });
    case "treeType":
      return textError("Tree type", raw, {
        min: 3, max: 100, pattern: DESCRIPTIVE_PATTERN, allowed: "letters, spaces and . , & ' ( ) / -", minLetters: 3,
      });
    case "purpose":
      return textError("Purpose", raw, {
        min: 3, max: 200, pattern: PURPOSE_PATTERN, allowed: "letters, numbers, spaces and basic punctuation", minLetters: 3,
      });
    case "monthlyIncome":
      return numberError("Monthly income", raw, { min: 0, max: 1000000 });
    case "householdExpenses":
      return numberError("Monthly household expenses", raw, { min: 1, max: 1000000 });
    case "annualIncome":
      return numberError("Annual income", raw, { min: 0, max: 10000000 });
    case "landArea": {
      const error = numberError("Land area", raw, { min: 0, max: 100000000 });
      if (error) return error;
      return Number(raw) > 0 ? null : "Land area must be greater than 0.";
    }
    case "treeCount":
      return numberError("Number of trees", raw, { min: 1, max: 10000, integer: true });
    case "cohabitationYear":
      return numberError("Living together since (year)", raw, {
        min: 1900, max: new Date().getFullYear(), integer: true,
      });
    case "titleNo": {
      const rest = stripTitlePrefix(raw);
      if (!rest) return null;
      if (!DIGIT_GROUPS_PATTERN.test(rest)) {
        return "Title No. may only contain numbers separated by single hyphens after RT- (e.g. 025-2012002046).";
      }
      if (rest.length < 3) return "Title No. must have at least 3 characters after RT-.";
      if (rest.length > 20) return "Title No. must have at most 20 characters after RT-.";
      return null;
    }
    case "taxDeclarationNo":
      if (!DIGIT_GROUPS_PATTERN.test(raw)) {
        return "Tax Declaration No. may only contain numbers separated by single hyphens (e.g. 2013-13-0026-00026).";
      }
      if (raw.length < 3) return "Tax Declaration No. must be at least 3 characters.";
      if (raw.length > 25) return "Tax Declaration No. must be at most 25 characters.";
      return null;
    default:
      return null;
  }
}

export function isFieldRequired(key: string, configRequired: boolean | undefined, document?: string | null): boolean {
  return !!configRequired || (!!document && (DOCUMENT_REQUIRED_FIELDS[document] ?? []).includes(key));
}
