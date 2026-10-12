import BarangaySettingsModel from "../../model/barangaySettings.model";
import DocumentTemplateModel from "../../model/documentTemplate.model";
import OfficialModel from "../../model/official.model";
import SystemInfoModel from "../../model/systemInfo.model";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatWorkingDays(days: number[] = []): string {
  const known = days
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  if (!known.length) return "";
  if (known.length === 7) return "Every day";
  const labels = known.map((d) => DAY_NAMES[d]);
  if (known.join(",") === "1,2,3,4,5") return "Monday to Friday";
  if (known.join(",") === "1,2,3,4,5,6") return "Monday to Saturday";
  return labels.join(", ");
}

/**
 * Builds a single authoritative JSON block of REAL system data for the
 * resident-facing AI chatbot. The chatbot must answer only from this data so it
 * cannot invent office hours, fees, requirements, or officials.
 */
export class AIContextService {
  static async build(): Promise<string> {
    const [settings, templates, officials, systemInfo] = await Promise.all([
      BarangaySettingsModel.findOne().lean(),
      DocumentTemplateModel.find({ status: "active" })
        .select("name description fee currency requirements")
        .sort({ name: 1 })
        .lean(),
      OfficialModel.find({ status: "active" })
        .select("fullName position precedence")
        .sort({ position: 1, precedence: 1, fullName: 1 })
        .lean(),
      SystemInfoModel.findOne().lean(),
    ]);

    const barangay = (settings as any)?.barangay ?? {};
    const workSchedule = (settings as any)?.workSchedule;

    const data = {
      barangay: {
        name: barangay.name || "",
        municipality: barangay.municipality || "",
        province: barangay.province || "",
        region: barangay.region || "",
        address: barangay.address || "",
        contactNumber: barangay.contactNumber || "",
        email: barangay.email || "",
      },
      serviceHours: workSchedule
        ? {
            workingDays: formatWorkingDays(workSchedule.workingDays),
            timeSlots: (workSchedule.slots ?? []).map(
              (s: any) => `${s.startTime} - ${s.endTime}`,
            ),
            note: "Service/booking hours configured in the system.",
          }
        : null,
      officials: (officials as any[]).map((o) => ({
        position: o.position,
        name: o.fullName,
      })),
      documentFees: (templates as any[]).map((t) => ({
        document: t.name,
        description: t.description || "",
        fee: `${t.currency || "PHP"} ${t.fee}`,
        requirements:
          Array.isArray(t.requirements) && t.requirements.length
            ? t.requirements
            : [],
      })),
      documentRequestChannels: {
        general:
          "There are TWO ways to request a barangay document: WALK-IN or ONLINE. Always mention both when asked how to get or request a document.",
        walkIn:
          "Walk-in: go to the barangay hall during service hours and ask the barangay staff to record your document request. The staff encodes it in the system, collects the fee, then processes and releases the document.",
        online:
          "Online: sign in to this Barangay Information System with a verified resident account, open 'Request a Document', choose the document, and submit the request. You can track its status in 'My Documents'.",
        payment:
          "The document fee must be paid before release. Pay online via 'Pay Online' in My Documents, or over the counter at the barangay hall.",
        release:
          "Once the request is approved/processed, download the PDF from 'My Documents' or claim the printed copy at the barangay hall.",
      },
      extraBarangayNotes: (systemInfo as any)?.aiContext || "",
    };

    return JSON.stringify(data, null, 2);
  }
}
