import { MAX_NAME_LENGTH } from "./validation";

export const MAX_NAME_PART_LENGTH = 50;

const NAME_PART_PATTERN = /^[a-zA-ZñÑ.'\-\s]+$/;

export interface NameParts {
  firstName: string;
  middleName: string;
  lastName: string;
}

type NamePartsInput = { [K in keyof NameParts]?: string | null };

export const normalizeNamePart = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

export const formatFullName = (parts: NamePartsInput): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .map(normalizeNamePart)
    .filter(Boolean)
    .join(" ");

export const formatCensusName = (parts: NamePartsInput): string => {
  const last = normalizeNamePart(parts.lastName);
  const given = [parts.firstName, parts.middleName].map(normalizeNamePart).filter(Boolean).join(" ");
  if (!last) return given;
  return given ? `${last},${given}` : last;
};

export const hasNameParts = (body: Record<string, unknown>): boolean =>
  ["firstName", "middleName", "lastName"].some((key) => body[key] !== undefined && body[key] !== null);

const partError = (label: string, value: string, required: boolean): string | null => {
  if (!value) return required ? `${label} is required` : null;
  if (value.length > MAX_NAME_PART_LENGTH) return `${label} must be at most ${MAX_NAME_PART_LENGTH} characters`;
  if (!NAME_PART_PATTERN.test(value)) return `${label} can only contain letters, spaces, periods, hyphens and apostrophes`;
  if (!/[a-zA-ZñÑ]/.test(value)) return `${label} must contain at least one letter`;
  return null;
};

export type NamePartsResult =
  | { ok: true; parts: NameParts; name: string }
  | { ok: false; error: string };

export const parseNameParts = (body: Record<string, unknown>): NamePartsResult => {
  const parts: NameParts = {
    firstName: normalizeNamePart(body.firstName),
    middleName: normalizeNamePart(body.middleName),
    lastName: normalizeNamePart(body.lastName),
  };
  const error =
    partError("First name", parts.firstName, true) ||
    partError("Middle name", parts.middleName, false) ||
    partError("Last name", parts.lastName, true);
  if (error) return { ok: false, error };
  const name = formatFullName(parts);
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Full name must be at most ${MAX_NAME_LENGTH} characters` };
  }
  return { ok: true, parts, name };
};

const isMissingName = (raw: string): boolean => !raw || raw.toUpperCase() === "N/A";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const nameSortText = (raw: unknown): string => normalizeNamePart(raw).replace(/\s*,\s*/g, " ");

export const compareCensusNames = (a: unknown, b: unknown): number => {
  const ma = isMissingName(normalizeNamePart(a));
  const mb = isMissingName(normalizeNamePart(b));
  if (ma !== mb) return ma ? 1 : -1;
  return collator.compare(nameSortText(a), nameSortText(b));
};
