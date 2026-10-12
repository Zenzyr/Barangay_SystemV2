import { DEFAULT_SMS_TEMPLATES } from "../types/barangaySettings.type";

// ─── Document display names (mirrors frontend DOCUMENT_NAMES) ────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Clearance",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker:
    "Barangay Certification (First-Time Jobseeker)",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
  certificationOfCohabitant: "Certification of Cohabitant",
  soloCertification: "Solo Certification",
};

export const documentLabel = (doc: string): string =>
  DOCUMENT_NAMES[doc] || doc;

export const firstName = (fullName: string | undefined | null): string => {
  if (!fullName) return "there";
  return fullName.trim().split(" ")[0];
};

/** Every template key the SMS system understands. */
export const SMS_TEMPLATE_KEYS = Object.keys(
  DEFAULT_SMS_TEMPLATES,
) as SmsTemplateKey[];
export type SmsTemplateKey = keyof typeof DEFAULT_SMS_TEMPLATES;

/** Default (built-in) templates, used when a saved template is blank. */
export const SMS_TEMPLATE_DEFAULTS = DEFAULT_SMS_TEMPLATES;

/**
 * Builds the placeholder map shared by all templates. Keep this in sync with
 * the variables advertised in the SMS settings UI.
 */
export const smsVars = (input: {
  name?: string | null;
  document?: string | null;
  status?: string | null;
}): Record<string, string> => {
  const name = input.name ?? "";
  return {
    first_name: firstName(name),
    name,
    document: input.document ? documentLabel(input.document) : "",
    status: input.status ?? "",
  };
};

/** Maps a request status string to the matching status-update template key. */
export const statusTemplateKey = (status: string): SmsTemplateKey => {
  switch ((status || "").trim().toLowerCase()) {
    case "processing":
      return "statusProcessing";
    case "ready":
    case "to claim":
      return "statusReady";
    case "released":
      return "statusReleased";
    case "cancelled":
    case "canceled":
      return "statusCancelled";
    case "completed":
      return "statusCompleted";
    default:
      return "statusOther";
  }
};

/**
 * Replaces {{placeholder}} tokens in a template. Unknown tokens resolve to an
 * empty string so a stray placeholder never leaks into a sent message.
 */
export const renderSmsTemplate = (
  template: string,
  vars: Record<string, string>,
): string =>
  String(template ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
