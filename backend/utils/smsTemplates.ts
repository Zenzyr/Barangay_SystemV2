// ─── Document display names (mirrors frontend DOCUMENT_NAMES) ────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Clearance",
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

export const documentLabel = (doc: string): string => DOCUMENT_NAMES[doc] || doc;

const firstName = (fullName: string | undefined | null): string => {
  if (!fullName) return "there";
  return fullName.trim().split(" ")[0];
};

export const smsTemplates = {
  requestReceived: (name: string, doc: string) =>
    `Hi ${firstName(name)}, we received your request for ${documentLabel(doc)}. We'll text you updates on its status. - Barangay Office`,

  statusUpdate: (name: string, doc: string, status: string) => {
    const label = documentLabel(doc);
    const who = firstName(name);
    switch (status) {
      case "processing":
        return `Hi ${who}, your request for ${label} is now being processed.`;
      case "to claim":
        return `Hi ${who}, your ${label} is ready for pickup at the barangay hall. Please bring a valid ID.`;
      case "completed":
        return `Hi ${who}, your request for ${label} has been marked completed. Thank you!`;
      default:
        return `Hi ${who}, your request for ${label} status has been updated to "${status}".`;
    }
  },

  paymentReceived: (name: string, doc: string) =>
    `Hi ${firstName(name)}, we've received your payment for ${documentLabel(doc)}. Thank you!`,

  accountStatus: (name: string, status: "approved" | "rejected") =>
    status === "approved"
      ? `Hi ${firstName(name)}, your barangay resident account has been approved! You can now log in and request documents.`
      : `Hi ${firstName(name)}, your barangay resident account application was rejected. Please visit or contact the barangay office, or resubmit your ID documents.`,
};
