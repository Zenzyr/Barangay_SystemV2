/**
 * Positions that allow at most one ACTIVE holder at any given time.
 * Saving a new ACTIVE official in one of these positions automatically
 * deactivates the previous active holder (historical record).
 */
export const SINGLE_HOLDER_POSITIONS = [
  "Punong Barangay",
  "Barangay Secretary",
  "Barangay Treasurer",
  "SK Chairperson",
] as const;

export type SingleHolderPosition = (typeof SINGLE_HOLDER_POSITIONS)[number];

export const MULTI_HOLDER_POSITIONS = [
  "Barangay Kagawad",
  "SK Kagawad",
  "Barangay Tanod",
] as const;

/**
 * Every supported role in the officials directory. Order matters for display.
 */
/**
 * Default suggested positions. Position is a free string so admins can add
 * bespoke roles without code changes; "Other" lets them type a custom one.
 */
export const OFFICIAL_POSITIONS = [
  "Punong Barangay",
  "Barangay Kagawad",
  "Barangay Secretary",
  "Barangay Treasurer",
  "SK Chairperson",
  "SK Kagawad",
  "Barangay Tanod",
  "Other",
] as const;

export type OfficialPosition = (typeof OFFICIAL_POSITIONS)[number] | (string & {});

export interface officialInterfaceInput {
  fullName: string;
  position: string;
  /** Status. Only one ACTIVE holder is allowed per single-holder position. */
  status: "active" | "inactive";
  /** Display order among officials of the same position (low = appears first). */
  precedence?: number;
  termStart?: string;
  termEnd?: string;
  /** Optional Term label shown in records, e.g. "2023–2026". */
  termLabel?: string;
  signatureImage?: string;
  photo?: string;
  /** Contact info for the official when required. */
  contact?: string;
  notes?: string;
}

export interface officialInterface extends officialInterfaceInput {
  _id: string;
  createdAt: string;
  updatedAt: string;
}