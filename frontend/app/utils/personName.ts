export const MAX_NAME_PART_LENGTH = 50;
export const MAX_FULL_NAME_LENGTH = 100;

const NAME_PART_PATTERN = /^[a-zA-ZñÑ.'\-\s]+$/;

export interface NameParts {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}

export const normalizeNamePart = (value: string | null | undefined): string =>
  (value ?? "").trim().replace(/\s+/g, " ");

export const formatFullName = (parts: NameParts): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .map(normalizeNamePart)
    .filter(Boolean)
    .join(" ");

export const namePartError = (label: string, value: string, required: boolean): string => {
  const v = normalizeNamePart(value);
  if (!v) return required ? `${label} is required` : "";
  if (v.length > MAX_NAME_PART_LENGTH) return `${label} must be at most ${MAX_NAME_PART_LENGTH} characters`;
  if (!NAME_PART_PATTERN.test(v)) return `${label} can only contain letters, spaces, periods, hyphens and apostrophes`;
  if (!/[a-zA-ZñÑ]/.test(v)) return `${label} must contain at least one letter`;
  return "";
};

export const fullNameLengthError = (parts: NameParts): string =>
  formatFullName(parts).length > MAX_FULL_NAME_LENGTH
    ? `Full name must be at most ${MAX_FULL_NAME_LENGTH} characters`
    : "";

export const censusNameToParts = (censusName: string): NameParts | null => {
  const name = normalizeNamePart(censusName);
  const commaIndex = name.indexOf(",");
  if (commaIndex < 0) return null;
  const lastName = name.slice(0, commaIndex).trim();
  const firstName = name.slice(commaIndex + 1).trim();
  if (!lastName || !firstName) return null;
  return { firstName, middleName: "", lastName };
};

const nameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const isMissingName = (value: string): boolean => !value || value.toUpperCase() === "N/A";

const nameSortText = (value: string | null | undefined): string =>
  normalizeNamePart(value).replace(/\s*,\s*/g, " ");

export const compareNamesAZ = (a: string | null | undefined, b: string | null | undefined): number => {
  const ma = isMissingName(normalizeNamePart(a));
  const mb = isMissingName(normalizeNamePart(b));
  if (ma !== mb) return ma ? 1 : -1;
  return nameCollator.compare(nameSortText(a), nameSortText(b));
};
