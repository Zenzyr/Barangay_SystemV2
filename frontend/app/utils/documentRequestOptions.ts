import {
  Clock,
  Loader2,
  FileCheck,
  CheckCircle2,
  Ban,
  FileText,
  ScrollText,
  BadgeCheck,
  Building2,
} from "lucide-react";

// ─── Document icons ───────────────────────────────────────────────
// "barangayClearance" is a legacy alias of "barangayCertificate". It is kept
// in the display maps so historical requests still render the consolidated
// "Barangay Certificate" identity, but it is NOT in selection lists anymore.
export const DOCUMENT_ICONS: Record<string, React.ElementType> = {
  barangayCertificate: FileText,
  barangayClearance: FileText,
  certificateOfResidency: BadgeCheck,
  certificateOfIndigency: ScrollText,
  certificateOfGoodMoralCharacter: BadgeCheck,
  certificateOfUnemployment: ScrollText,
  barangayBusinessClearance: Building2,
  certificateOfAttestation: FileText,
  certificationOfTreesCutting: FileText,
  barangayCertification: FileText,
  certificateOfFirstTimeJobseeker: ScrollText,
  firstTimeJobseekerOath: ScrollText,
  certificateOfLowIncome: ScrollText,
  endorsementLetter: FileText,
};

// ─── Document display names ───────────────────────────────────────
export const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  certificateOfGoodMoralCharacter: "Certificate of Good Moral Character",
  certificateOfUnemployment: "Certificate of Unemployment",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
};

// Canonical, selectable document types (no Barangay Clearance — it is
// consolidated into Barangay Certificate).
export const SELECTABLE_DOCUMENT_TYPES = [
  "barangayCertificate",
  "certificateOfResidency",
  "certificateOfIndigency",
  "certificateOfGoodMoralCharacter",
  "certificateOfUnemployment",
  "barangayBusinessClearance",
  "certificateOfAttestation",
  "certificationOfTreesCutting",
  "barangayCertification",
  "certificateOfFirstTimeJobseeker",
  "firstTimeJobseekerOath",
  "certificateOfLowIncome",
  "endorsementLetter",
] as const;

export const DOCUMENT_OPTIONS = SELECTABLE_DOCUMENT_TYPES.map((value) => ({
  value,
  label: DOCUMENT_NAMES[value],
}));

export const DOCUMENT_DESCRIPTIONS: Record<string, string> = {
  barangayCertificate: "Official certification of your residency and background",
  barangayClearance: "Official certification of your residency and background",
  certificateOfResidency: "Proof that you are a resident of this barangay",
  certificateOfIndigency: "Documentation for financial or medical assistance",
  certificateOfGoodMoralCharacter: "Character reference for employment or school",
  certificateOfUnemployment: "Certification of current unemployment status",
  barangayBusinessClearance: "Permit for operating a business in the barangay",
  certificateOfAttestation: "Attestation of income and household expenses",
  certificationOfTreesCutting: "Certification for cutting trees on your land",
  barangayCertification: "Official certification of your personal details",
  certificateOfFirstTimeJobseeker: "RA 11261 certificate for first-time jobseekers",
  firstTimeJobseekerOath: "Oath of Undertaking signed under RA 11261",
  certificateOfLowIncome: "Certification of low income for assistance",
  endorsementLetter: "Endorsement letter for scholarship applicants",
};

// ─── Status config ────────────────────────────────────────────────
export interface StatusConfigEntry {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}

export const STATUS_CONFIG: Record<string, StatusConfigEntry> = {
  pending:    { label: "Pending",    icon: Clock,        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  processing: { label: "Processing", icon: Loader2,      bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
  "to claim": { label: "To Claim",   icon: FileCheck,    bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
  completed:  { label: "Completed",  icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected:   { label: "Rejected",   icon: Ban,          bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
};

// ─── Request timestamp display ────────────────────────────────────
// The duplicate-prevention rule uses the single request timestamp. For new
// requests that is stored as requestDate (YYYY-MM-DD) + requestTime (HH:mm);
// legacy requests fall back to dateIssued, then the document _id time.
export function formatRequestDate(doc: {
  requestDate?: string | null;
  dateIssued?: string | null;
  _id?: string;
}): string {
  const raw = doc.requestDate || doc.dateIssued || doc._id || "";
  if (!raw) return "—";
  try {
    const date = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

export function formatRequestTime(doc: {
  requestTime?: string | null;
}): string {
  return doc.requestTime || "";
}