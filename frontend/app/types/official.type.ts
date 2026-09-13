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

export const SINGLE_HOLDER_POSITIONS = [
  "Punong Barangay",
  "Barangay Secretary",
  "Barangay Treasurer",
  "SK Chairperson",
] as const;

export interface officialInterface {
  _id: string;
  fullName: string;
  position: string;
  status: "active" | "inactive";
  precedence: number;
  termStart?: string;
  termEnd?: string;
  termLabel?: string;
  signatureImage?: string;
  photo?: string;
  contact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface officialInput {
  fullName: string;
  position: string;
  status?: "active" | "inactive";
  precedence?: number;
  termStart?: string;
  termEnd?: string;
  termLabel?: string;
  signatureImage?: string;
  photo?: string;
  contact?: string;
  notes?: string;
}