export const TITLE_NO_PREFIX = "RT-";

export const DOCUMENT_SPECIFIC_FIELDS = [
  "businessName",
  "businessAddress",
  "businessType",
  "businessNature",
  "workStatus",
  "workplace",
  "monthlyIncome",
  "expenseType",
  "householdExpenses",
  "assistanceTo",
  "titleNo",
  "taxDeclarationNo",
  "landArea",
  "treeCount",
  "treeType",
  "spouseName",
  "spouseDateOfBirth",
  "cohabitationYear",
  "annualIncome",
  "purpose",
];

const REQUIRED_DOCUMENT_FIELDS: Record<string, string[]> = {
  barangayBusinessClearance: ["businessName", "businessAddress", "businessType", "businessNature"],
  certificateOfAttestation: ["workStatus", "expenseType", "householdExpenses"],
  certificationOfTreesCutting: ["titleNo", "taxDeclarationNo", "landArea", "treeCount", "treeType"],
  certificateOfLowIncome: ["annualIncome", "purpose"],
  endorsementLetter: ["purpose"],
  certificationOfCohabitant: ["spouseName", "spouseDateOfBirth", "cohabitationYear"],
};

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business name",
  businessAddress: "Business address",
  businessType: "Business type",
  businessNature: "Nature of business",
  workStatus: "Employment status",
  workplace: "Workplace / company",
  monthlyIncome: "Monthly income",
  expenseType: "Type of unforeseen expense",
  householdExpenses: "Monthly household expenses",
  assistanceTo: "Assistance for",
  titleNo: "Title No.",
  taxDeclarationNo: "Tax Declaration No.",
  landArea: "Land area",
  treeCount: "Number of trees",
  treeType: "Tree type",
  spouseName: "Spouse name",
  spouseDateOfBirth: "Partner date of birth",
  cohabitationYear: "Living together since (year)",
  annualIncome: "Annual income",
  purpose: "Purpose",
};

const WORK_STATUSES = ["working", "non working", "self employed", "unemployed"];

const NAME_PATTERN = /^[a-zA-ZñÑ.'\-\s]+$/;
const ADDRESS_PATTERN = /^[a-zA-Z0-9ñÑ.,#'()/\-\s]+$/;
const BUSINESS_NAME_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/#!+\-\s]+$/;
const DESCRIPTIVE_PATTERN = /^[a-zA-ZñÑ.,&'()/\-\s]+$/;
const DESCRIPTIVE_WITH_DIGITS_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/\-\s]+$/;
const PURPOSE_PATTERN = /^[a-zA-Z0-9ñÑ.,&'()/#:;\-\s]+$/;
const DIGIT_GROUPS_PATTERN = /^\d+(-\d+)*$/;

const isEmpty = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === "";

const letterCount = (value: string) => (value.match(/[a-zA-ZñÑ]/g) || []).length;

const textError = (
  label: string,
  value: string,
  { min, max, pattern, minLetters = 1 }: { min: number; max: number; pattern: RegExp; minLetters?: number },
): string | null => {
  if (value.length < min) return `${label} must be at least ${min} characters`;
  if (value.length > max) return `${label} must be at most ${max} characters`;
  if (!pattern.test(value)) return `${label} contains characters that are not allowed`;
  if (letterCount(value) < minLetters) {
    return minLetters > 1
      ? `${label} must contain at least ${minLetters} letters`
      : `${label} must contain letters, not numbers only`;
  }
  return null;
};

const numberError = (
  label: string,
  raw: string,
  { min, max, integer = false }: { min: number; max: number; integer?: boolean },
): string | null => {
  if (!/^\d+(\.\d+)?$/.test(raw)) return `${label} must be a valid number`;
  if (integer && !/^\d+$/.test(raw)) return `${label} must be a whole number`;
  if (!integer && !/^\d+(\.\d{1,2})?$/.test(raw)) return `${label} can have at most 2 decimal places`;
  const n = Number(raw);
  if (n < min) return `${label} must be at least ${min}`;
  if (n > max) return `${label} must not exceed ${max}`;
  return null;
};

const stripTitlePrefix = (value: string): string => {
  let rest = value.trim().toUpperCase().replace(/\s+/g, "");
  while (/^RT-?/.test(rest)) rest = rest.replace(/^RT-?/, "");
  return rest;
};

export const normalizeTitleNo = (value: unknown): string => {
  const rest = stripTitlePrefix(String(value ?? ""));
  return rest ? `${TITLE_NO_PREFIX}${rest}` : "";
};

export const documentFieldError = (key: string, value: unknown): string | null => {
  if (isEmpty(value)) return null;
  const raw = String(value).trim();
  const label = FIELD_LABELS[key] ?? key;

  switch (key) {
    case "spouseName":
      return textError(label, raw, { min: 3, max: 100, pattern: NAME_PATTERN, minLetters: 2 });
    case "assistanceTo":
      return textError(label, raw, { min: 3, max: 100, pattern: DESCRIPTIVE_PATTERN, minLetters: 2 });
    case "businessName":
    case "workplace":
      return textError(label, raw, { min: 3, max: 120, pattern: BUSINESS_NAME_PATTERN, minLetters: 3 });
    case "businessAddress":
      return textError(label, raw, { min: 5, max: 255, pattern: ADDRESS_PATTERN, minLetters: 3 });
    case "businessType":
      return textError(label, raw, { min: 3, max: 60, pattern: DESCRIPTIVE_PATTERN, minLetters: 3 });
    case "businessNature":
      return textError(label, raw, { min: 3, max: 120, pattern: DESCRIPTIVE_WITH_DIGITS_PATTERN, minLetters: 3 });
    case "expenseType":
    case "treeType":
      return textError(label, raw, { min: 3, max: 100, pattern: DESCRIPTIVE_PATTERN, minLetters: 3 });
    case "purpose":
      return textError(label, raw, { min: 3, max: 200, pattern: PURPOSE_PATTERN, minLetters: 3 });
    case "workStatus":
      return WORK_STATUSES.includes(raw) ? null : `${label} is not a valid option`;
    case "spouseDateOfBirth": {
      const date = new Date(raw);
      if (!/^\d{4}-\d{2}-\d{2}/.test(raw) || isNaN(date.getTime())) return `${label} must be a valid date`;
      if (date.getFullYear() < 1900) return `${label} must be after the year 1900`;
      if (date.getTime() > Date.now()) return `${label} cannot be in the future`;
      return null;
    }
    case "monthlyIncome":
      return numberError(label, raw, { min: 0, max: 1000000 });
    case "householdExpenses":
      return numberError(label, raw, { min: 1, max: 1000000 });
    case "annualIncome":
      return numberError(label, raw, { min: 0, max: 10000000 });
    case "landArea": {
      const error = numberError(label, raw, { min: 0, max: 100000000 });
      if (error) return error;
      return Number(raw) > 0 ? null : `${label} must be greater than 0`;
    }
    case "treeCount":
      return numberError(label, raw, { min: 1, max: 10000, integer: true });
    case "cohabitationYear":
      return numberError(label, raw, { min: 1900, max: new Date().getFullYear(), integer: true });
    case "titleNo": {
      const rest = stripTitlePrefix(raw);
      if (!rest) return `${label} is required`;
      if (!DIGIT_GROUPS_PATTERN.test(rest)) {
        return `${label} may only contain numbers separated by single hyphens after ${TITLE_NO_PREFIX}`;
      }
      if (rest.length < 3 || rest.length > 20) {
        return `${label} must have 3 to 20 characters after ${TITLE_NO_PREFIX}`;
      }
      return null;
    }
    case "taxDeclarationNo":
      if (!DIGIT_GROUPS_PATTERN.test(raw)) {
        return `${label} may only contain numbers separated by single hyphens`;
      }
      if (raw.length < 3 || raw.length > 25) return `${label} must be 3 to 25 characters`;
      return null;
    default:
      return null;
  }
};

export const validateNewDocumentRequestFields = (
  document: string,
  data: Record<string, unknown>,
): string | null => {
  for (const key of REQUIRED_DOCUMENT_FIELDS[document] ?? []) {
    if (isEmpty(data[key])) return `${FIELD_LABELS[key] ?? key} is required`;
  }
  for (const key of DOCUMENT_SPECIFIC_FIELDS) {
    const error = documentFieldError(key, data[key]);
    if (error) return error;
  }
  if (!isEmpty(data.titleNo)) data.titleNo = normalizeTitleNo(data.titleNo);
  return null;
};

export const validateUpdatedDocumentRequestFields = (
  data: Record<string, unknown>,
  current: Record<string, unknown>,
): string | null => {
  for (const key of DOCUMENT_SPECIFIC_FIELDS) {
    if (!(key in data)) continue;
    if (String(data[key] ?? "").trim() === String(current[key] ?? "").trim()) continue;
    const error = documentFieldError(key, data[key]);
    if (error) return error;
    if (key === "titleNo" && !isEmpty(data.titleNo)) data.titleNo = normalizeTitleNo(data.titleNo);
  }
  return null;
};
